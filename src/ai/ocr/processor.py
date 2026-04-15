"""
Khmer OCR Processor

Phase 1: NOT ACTIVE (placeholder)
Phase 2: Google Document AI → structured text + layout
Phase 6: PaddleOCR-Khmer fine-tuned model

Entry point: process(file_path) → StructuredDocument

TODO (Claude Code - Phase 2):
- Accept PDF/image file path
- Call Google Document AI API
- Extract text blocks with positions
- Detect document structure (headers, body, tables, signatures)
- Return structured JSON with text + layout info
- Handle Khmer script, seals, stamps, handwritten annotations
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TextBlock:
    text: str
    x: float
    y: float
    width: float
    height: float
    font_size: float = 12.0
    is_bold: bool = False
    block_type: str = "body"  # header, body, table, signature, seal


@dataclass
class StructuredDocument:
    pages: list = field(default_factory=list)
    full_text: str = ""
    metadata: dict = field(default_factory=dict)
    blocks: list[TextBlock] = field(default_factory=list)


def process(file_path: str) -> StructuredDocument:
    """
    Process a PDF/image file through Khmer OCR.
    Returns structured document with text and layout info.
    """
    raise NotImplementedError("OCR processor not yet implemented. Coming in Phase 2.")
