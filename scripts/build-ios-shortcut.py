"""Build and sign the 'Log Purchase' iOS Shortcut."""

from __future__ import annotations

import json
import plistlib
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_OUT = ROOT / "public" / "shortcuts" / "Log-Purchase.shortcut"
UNSIGNED_OUT = ROOT / "shortcuts" / "Log-Purchase.unsigned.shortcut"

OBJ = "\ufffc"  # object replacement character used by Shortcuts magic variables
DEFAULT_BASE_URL = "https://monier.yarinlevi.dev"
SHORTCUT_NAME = "Log Purchase"

HUBSIGN_ENDPOINTS = [
    "https://hubsign.routinehub.services/sign",
    "https://hubsign.routinehub.co/sign",
]


def new_uuid() -> str:
    return str(uuid.uuid4()).upper()


def token_string(text: str, attachments: dict | None = None) -> dict:
    value: dict = {"string": text}
    if attachments:
        value["attachmentsByRange"] = attachments
    return {"Value": value, "WFSerializationType": "WFTextTokenString"}


def magic(output_uuid: str, output_name: str) -> dict:
    return token_string(
        OBJ,
        {
            "{0, 1}": {
                "OutputName": output_name,
                "OutputUUID": output_uuid,
                "Type": "ActionOutput",
            }
        },
    )


def magic_attachment(output_uuid: str, output_name: str) -> dict:
    return {
        "Value": {
            "OutputName": output_name,
            "OutputUUID": output_uuid,
            "Type": "ActionOutput",
        },
        "WFSerializationType": "WFTextTokenAttachment",
    }


def joined(prefix_uuid: str, prefix_name: str, suffix: str) -> dict:
    return token_string(
        OBJ + suffix,
        {
            "{0, 1}": {
                "OutputName": prefix_name,
                "OutputUUID": prefix_uuid,
                "Type": "ActionOutput",
            }
        },
    )


def bearer(token_uuid: str) -> dict:
    return token_string(
        f"Bearer {OBJ}",
        {
            "{7, 1}": {
                "OutputName": "Token",
                "OutputUUID": token_uuid,
                "Type": "ActionOutput",
            }
        },
    )


def dict_item(key: str, value: dict) -> dict:
    return {
        "WFItemType": 0,
        "WFKey": token_string(key),
        "WFValue": {"Value": value},
    }


def dictionary_field(items: list[dict]) -> dict:
    return {
        "Value": {"WFDictionaryFieldValueItems": items},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def auth_headers(token_uuid: str) -> dict:
    return dictionary_field(
        [
            dict_item("Authorization", bearer(token_uuid)),
            dict_item("Accept", token_string("application/json")),
        ]
    )


def action(identifier: str, **params) -> dict:
    params.setdefault("UUID", new_uuid())
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": params,
    }


def build_workflow() -> dict:
    base_uuid = new_uuid()
    token_uuid = new_uuid()
    amount_uuid = new_uuid()
    merchant_uuid = new_uuid()
    categories_url_uuid = new_uuid()
    categories_dict_uuid = new_uuid()
    category_names_uuid = new_uuid()
    category_uuid = new_uuid()
    cards_url_uuid = new_uuid()
    cards_dict_uuid = new_uuid()
    card_names_uuid = new_uuid()
    card_uuid = new_uuid()
    post_uuid = new_uuid()
    result_dict_uuid = new_uuid()
    message_uuid = new_uuid()

    actions = [
        action(
            "is.workflow.actions.comment",
            WFCommentActionText=(
                "Logs a purchase to Finance.\n\n"
                "On import, paste:\n"
                "1. App URL (no trailing slash)\n"
                "2. API token from Settings → Quick Log\n\n"
                "Then: amount → category → card → merchant."
            ),
        ),
        action(
            "is.workflow.actions.gettext",
            UUID=base_uuid,
            CustomOutputName="Base URL",
            WFTextActionText=DEFAULT_BASE_URL,
        ),
        action(
            "is.workflow.actions.gettext",
            UUID=token_uuid,
            CustomOutputName="Token",
            WFTextActionText="",
        ),
        action(
            "is.workflow.actions.ask",
            UUID=amount_uuid,
            CustomOutputName="Amount",
            WFAskActionPrompt="How much did it cost?",
            WFInputType="Number",
        ),
        action(
            "is.workflow.actions.ask",
            UUID=merchant_uuid,
            CustomOutputName="Merchant",
            WFAskActionPrompt="Merchant (leave empty if none)",
            WFInputType="Text",
        ),
        action(
            "is.workflow.actions.downloadurl",
            UUID=categories_url_uuid,
            CustomOutputName="Categories response",
            ShowHeaders=False,
            WFHTTPMethod="GET",
            WFURL=joined(base_uuid, "Base URL", "/api/categories"),
            WFHTTPHeaders=auth_headers(token_uuid),
        ),
        action(
            "is.workflow.actions.detect.dictionary",
            UUID=categories_dict_uuid,
            CustomOutputName="Categories dictionary",
            WFInput=magic_attachment(categories_url_uuid, "Categories response"),
        ),
        action(
            "is.workflow.actions.getvalueforkey",
            UUID=category_names_uuid,
            CustomOutputName="Category names",
            WFDictionaryKey="names",
            WFInput=magic_attachment(categories_dict_uuid, "Categories dictionary"),
        ),
        action(
            "is.workflow.actions.choosefromlist",
            UUID=category_uuid,
            CustomOutputName="Category",
            WFChooseFromListPrompt="Category",
            WFInput=magic_attachment(category_names_uuid, "Category names"),
        ),
        action(
            "is.workflow.actions.downloadurl",
            UUID=cards_url_uuid,
            CustomOutputName="Cards response",
            ShowHeaders=False,
            WFHTTPMethod="GET",
            WFURL=joined(base_uuid, "Base URL", "/api/payment-methods"),
            WFHTTPHeaders=auth_headers(token_uuid),
        ),
        action(
            "is.workflow.actions.detect.dictionary",
            UUID=cards_dict_uuid,
            CustomOutputName="Cards dictionary",
            WFInput=magic_attachment(cards_url_uuid, "Cards response"),
        ),
        action(
            "is.workflow.actions.getvalueforkey",
            UUID=card_names_uuid,
            CustomOutputName="Card names",
            WFDictionaryKey="names",
            WFInput=magic_attachment(cards_dict_uuid, "Cards dictionary"),
        ),
        action(
            "is.workflow.actions.choosefromlist",
            UUID=card_uuid,
            CustomOutputName="Card",
            WFChooseFromListPrompt="Card",
            WFInput=magic_attachment(card_names_uuid, "Card names"),
        ),
        action(
            "is.workflow.actions.downloadurl",
            UUID=post_uuid,
            CustomOutputName="Purchase response",
            ShowHeaders=False,
            WFHTTPMethod="POST",
            WFHTTPBodyType="JSON",
            WFURL=joined(base_uuid, "Base URL", "/api/quick-purchase"),
            WFHTTPHeaders=auth_headers(token_uuid),
            WFJSONValues=dictionary_field(
                [
                    dict_item("amount", magic(amount_uuid, "Amount")),
                    dict_item("category", magic(category_uuid, "Category")),
                    dict_item("paymentMethod", magic(card_uuid, "Card")),
                    dict_item("merchant", magic(merchant_uuid, "Merchant")),
                ]
            ),
        ),
        action(
            "is.workflow.actions.detect.dictionary",
            UUID=result_dict_uuid,
            CustomOutputName="Purchase dictionary",
            WFInput=magic_attachment(post_uuid, "Purchase response"),
        ),
        action(
            "is.workflow.actions.getvalueforkey",
            UUID=message_uuid,
            CustomOutputName="Message",
            WFDictionaryKey="message",
            WFInput=magic_attachment(result_dict_uuid, "Purchase dictionary"),
        ),
        action(
            "is.workflow.actions.notification",
            WFNotificationActionTitle="Purchase logged",
            WFNotificationActionBody=magic(message_uuid, "Message"),
        ),
        action(
            "is.workflow.actions.showresult",
            Text=magic(message_uuid, "Message"),
        ),
    ]

    return {
        "WFWorkflowClientVersion": "3306.0.4",
        "WFWorkflowClientRelease": "26.0",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowTypes": ["NCWidget", "WatchKit"],
        "WFQuickActionSurfaces": [],
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": 4292093695,
            "WFWorkflowIconGlyphNumber": 59511,
        },
        "WFWorkflowImportQuestions": [
            {
                "ActionIndex": 1,
                "Category": "Parameter",
                "DefaultValue": DEFAULT_BASE_URL,
                "ParameterKey": "WFTextActionText",
                "Text": "Finance app URL (no trailing slash)",
            },
            {
                "ActionIndex": 2,
                "Category": "Parameter",
                "DefaultValue": "",
                "ParameterKey": "WFTextActionText",
                "Text": "Paste your Quick Log API token (starts with fin_)",
            },
        ],
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowHasShortcutInputVariables": False,
        "WFWorkflowHasOutputFallback": False,
        "WFWorkflowActions": actions,
    }


def sign_with_hubsign(workflow: dict) -> bytes:
    xml = plistlib.dumps(workflow, fmt=plistlib.FMT_XML).decode("utf-8")
    payload = json.dumps(
        {"shortcutName": SHORTCUT_NAME, "shortcut": xml}
    ).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "cherri/1.2",
        "Origin": "https://routinehub.co",
        "Referer": "https://routinehub.co/",
        "Accept": "*/*",
    }
    last_error = None
    for url in HUBSIGN_ENDPOINTS:
        req = Request(url, data=payload, headers=headers, method="POST")
        try:
            with urlopen(req, timeout=45) as response:
                data = response.read()
            if data.startswith(b"AEA1"):
                return data
            last_error = RuntimeError(
                f"{url} returned unexpected bytes: {data[:40]!r}"
            )
        except HTTPError as error:
            last_error = error
            body = error.read()[:300]
            print(f"HubSign {url} -> HTTP {error.code}: {body!r}")
        except URLError as error:
            last_error = error
            print(f"HubSign {url} failed: {error}")
    raise RuntimeError(f"Could not sign shortcut via HubSign: {last_error}")


def main() -> None:
    workflow = build_workflow()
    UNSIGNED_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)

    unsigned = plistlib.dumps(workflow, fmt=plistlib.FMT_BINARY)
    UNSIGNED_OUT.write_bytes(unsigned)
    print(f"Wrote unsigned shortcut ({len(unsigned)} bytes): {UNSIGNED_OUT}")

    signed = sign_with_hubsign(workflow)
    PUBLIC_OUT.write_bytes(signed)
    copy = ROOT / "shortcuts" / "Log Purchase.shortcut"
    copy.write_bytes(signed)
    print(f"Wrote signed shortcut ({len(signed)} bytes): {PUBLIC_OUT}")
    print(f"Copied to: {copy}")


if __name__ == "__main__":
    main()
