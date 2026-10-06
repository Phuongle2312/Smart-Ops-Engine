from app.taxonomy import ERROR_TYPES


def test_every_error_type_has_runbook(kb):
    missing = [c for c in ERROR_TYPES if kb.runbook(c) is None]
    assert not missing, f"Thiếu runbook: {missing}"


def test_runbook_has_required_sections(kb):
    for code in ERROR_TYPES:
        content = kb.runbook(code).content
        for section in ("Nguyên nhân thường gặp", "Lệnh chẩn đoán", "Hướng xử lý", "Khi nào leo thang"):
            assert section in content, f"{code} thiếu mục {section}"


def test_keyword_related_finds_relevant_runbook(kb):
    titles = [r.title for r in kb.related("nvidia-smi VRAM CUDA batch size")]
    assert any("CUDA" in t for t in titles)
