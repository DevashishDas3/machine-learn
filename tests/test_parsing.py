import pytest

from pydantic import BaseModel

from utils.parsing import extract_json_payload, parse_model_output


class DemoModel(BaseModel):
    value: int


def test_extract_json_payload_from_wrapped_text() -> None:
    text = "some preface\n{\"value\": 7}\nextra"
    payload = extract_json_payload(text)
    assert payload == "{\"value\": 7}"


def test_parse_model_output_validates_schema() -> None:
    parsed = parse_model_output("{\"value\": 3}", DemoModel)
    assert parsed.value == 3


def test_parse_model_output_raises_for_invalid_json() -> None:
    with pytest.raises(ValueError):
        parse_model_output("not json", DemoModel)
