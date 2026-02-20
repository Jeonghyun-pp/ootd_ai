from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F


def _default_artifacts_path() -> Path:
    # <repo>/ml-server/app/model_loader.py -> <repo>/model/artifacts.pt
    return Path(__file__).resolve().parents[2] / "model" / "artifacts.pt"


def _safe_torch_load(path: Path) -> Dict[str, Any]:
    # torch>=2.6 defaults to weights_only=True, but this artifact stores Python objects.
    try:
        payload = torch.load(path, map_location="cpu", weights_only=False)
    except TypeError:
        payload = torch.load(path, map_location="cpu")

    if not isinstance(payload, dict):
        raise ValueError("artifacts file must be a dict payload")
    return payload


_TOKEN_RE = re.compile(r"[A-Za-z0-9\uac00-\ud7a3]+")


def basic_tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall((text or "").lower())


def normalize_temp_range(
    value: Any, default: Tuple[int, int] = (-50, 50)
) -> Tuple[int, int]:
    if isinstance(value, (list, tuple)) and len(value) == 2:
        try:
            return int(value[0]), int(value[1])
        except (TypeError, ValueError):
            return default
    return default


class TextEncoder(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        emb_dim: int,
        hidden_dim: int,
        out_dim: int,
        pad_idx: int,
        use_attn: bool,
        nhead: int,
        ff_dim: int,
    ) -> None:
        super().__init__()
        self.emb = nn.Embedding(vocab_size, emb_dim, padding_idx=pad_idx)
        self.use_attn = use_attn
        if use_attn:
            layer = nn.TransformerEncoderLayer(
                d_model=emb_dim,
                nhead=nhead,
                dim_feedforward=ff_dim,
                batch_first=True,
            )
            self.attn = nn.TransformerEncoder(layer, num_layers=1)
        else:
            self.attn = None

        self.mlp = nn.Sequential(
            nn.Linear(emb_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, out_dim),
        )

    def forward(
        self, input_ids: torch.Tensor, attention_mask: torch.Tensor
    ) -> torch.Tensor:
        x = self.emb(input_ids)
        if self.use_attn and self.attn is not None:
            key_padding_mask = attention_mask == 0
            x = self.attn(x, src_key_padding_mask=key_padding_mask)

        mask = attention_mask.unsqueeze(-1).float()
        x = x * mask
        denom = mask.sum(dim=1).clamp_min(1.0)
        pooled = x.sum(dim=1) / denom
        z = self.mlp(pooled)
        return F.normalize(z, dim=-1)


class ItemEncoder(nn.Module):
    def __init__(
        self,
        maps: Dict[str, Dict[str, int]],
        feature_cols: List[str],
        emb_dim: int,
        hidden_dim: int,
        out_dim: int,
    ) -> None:
        super().__init__()
        self.feature_cols = feature_cols
        self.embs = nn.ModuleDict(
            {col: nn.Embedding(len(maps[col]), emb_dim) for col in feature_cols}
        )
        in_dim = emb_dim * len(feature_cols)
        self.proj = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, out_dim),
        )

    def forward(self, feats: Dict[str, torch.Tensor]) -> torch.Tensor:
        vecs = [self.embs[col](feats[col]) for col in self.feature_cols]
        x = torch.cat(vecs, dim=1)
        z = self.proj(x)
        return F.normalize(z, dim=-1)


@dataclass
class ArtifactsBundle:
    cfg: Dict[str, Any]
    feature_cols: List[str]
    maps: Dict[str, Dict[str, int]]
    text_stoi: Dict[str, int]
    text_pad_idx: int
    text_unk_idx: int
    text_encoder: TextEncoder
    item_encoder: ItemEncoder
    item_embs: torch.Tensor
    item_metas: List[Dict[str, Any]]
    item_table_min: Dict[str, Dict[str, Any]]
    weather_label_to_temp_range: Dict[str, Tuple[int, int]]
    device: torch.device

    @property
    def max_len(self) -> int:
        return int(self.cfg["max_len"])

    @torch.no_grad()
    def encode_text(self, text: str) -> torch.Tensor:
        tokens = basic_tokenize(text)
        ids = [
            self.text_stoi.get(token, self.text_unk_idx) for token in tokens
        ][: self.max_len]
        attn = [1] * len(ids)
        if not ids:
            # Transformer encoder cannot consume an all-masked sequence.
            ids = [self.text_unk_idx]
            attn = [1]
        if len(ids) < self.max_len:
            pad_len = self.max_len - len(ids)
            ids.extend([self.text_pad_idx] * pad_len)
            attn.extend([0] * pad_len)

        input_ids = torch.tensor(
            ids, dtype=torch.long, device=self.device
        ).unsqueeze(0)
        attention_mask = torch.tensor(
            attn, dtype=torch.long, device=self.device
        ).unsqueeze(0)
        return self.text_encoder(input_ids, attention_mask).cpu()

    @torch.no_grad()
    def encode_items(self, item_features: Dict[str, List[int]]) -> torch.Tensor:
        feats = {
            col: torch.tensor(values, dtype=torch.long, device=self.device)
            for col, values in item_features.items()
        }
        return self.item_encoder(feats).cpu()


def load_artifacts(
    artifacts_path: str | None = None, device: str | None = None
) -> ArtifactsBundle:
    path = Path(artifacts_path) if artifacts_path else _default_artifacts_path()
    if not path.exists():
        raise FileNotFoundError(f"artifacts file not found: {path}")

    payload = _safe_torch_load(path)

    cfg = payload["cfg"]
    feature_cols = payload["FEATURE_COLS"]
    maps = payload["maps"]
    tv = payload["text_vocab"]

    text_stoi = dict(tv["stoi"])
    text_pad_idx = int(tv["pad_idx"])
    text_unk_idx = int(tv["unk_idx"])

    target_device = torch.device(
        device or ("cuda" if torch.cuda.is_available() else "cpu")
    )

    text_encoder = TextEncoder(
        vocab_size=len(tv["itos"]),
        emb_dim=int(cfg["text_emb_dim"]),
        hidden_dim=int(cfg["text_hidden_dim"]),
        out_dim=int(cfg["embed_dim"]),
        pad_idx=text_pad_idx,
        use_attn=bool(cfg.get("text_use_attn", False)),
        nhead=int(cfg.get("text_attn_nhead", 4)),
        ff_dim=int(cfg.get("text_attn_ff", 256)),
    ).to(target_device)

    item_encoder = ItemEncoder(
        maps=maps,
        feature_cols=feature_cols,
        emb_dim=int(cfg["cat_emb_dim"]),
        hidden_dim=int(cfg["item_hidden_dim"]),
        out_dim=int(cfg["embed_dim"]),
    ).to(target_device)

    text_encoder.load_state_dict(payload["text_enc_state"], strict=True)
    item_encoder.load_state_dict(payload["item_enc_state"], strict=True)
    text_encoder.eval()
    item_encoder.eval()

    item_embs = payload.get(
        "item_embs", torch.empty(0, int(cfg["embed_dim"]))
    ).float().contiguous()
    item_metas = payload.get("item_metas", [])
    item_table_min = payload.get("item_table_min", {})

    weather_ranges_raw = payload.get("WEATHER_LABEL_TO_TEMP_RANGE", {})
    weather_ranges = {
        str(label): normalize_temp_range(rng, default=(-50, 50))
        for label, rng in weather_ranges_raw.items()
    }

    return ArtifactsBundle(
        cfg=cfg,
        feature_cols=feature_cols,
        maps=maps,
        text_stoi=text_stoi,
        text_pad_idx=text_pad_idx,
        text_unk_idx=text_unk_idx,
        text_encoder=text_encoder,
        item_encoder=item_encoder,
        item_embs=item_embs,
        item_metas=item_metas,
        item_table_min=item_table_min,
        weather_label_to_temp_range=weather_ranges,
        device=target_device,
    )
