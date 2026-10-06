import pytest

from app.vision import VisionUnavailable, parse_vision_json


def test_valid_json():
    r = parse_vision_json('{"error_code": "gpu_cuda_oom", "confidence": 0.9, "evidence": ["CUDA"]}')
    assert r.code == "GPU_CUDA_OOM" and r.confidence == 0.9


def test_code_outside_taxonomy_becomes_unknown():
    assert parse_vision_json('{"error_code": "DISK_FULL", "confidence": 0.99}').code == "UNKNOWN"


def test_confidence_is_clamped_and_bad_values_ignored():
    assert parse_vision_json('{"error_code": "RAM_LEAK", "confidence": 7}').confidence == 1.0
    assert parse_vision_json('{"error_code": "RAM_LEAK", "confidence": "abc"}').confidence == 0.0


@pytest.mark.parametrize("bad", ["not json", "[1,2]"])
def test_invalid_payload_raises(bad):
    with pytest.raises(VisionUnavailable):
        parse_vision_json(bad)
