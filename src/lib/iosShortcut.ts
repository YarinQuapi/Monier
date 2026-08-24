import "server-only";
import { randomUUID } from "node:crypto";

const OBJECT_REPLACEMENT = "\uFFFC";
const HUBSIGN_ENDPOINTS = [
  "https://hubsign.routinehub.services/sign",
  "https://hubsign.routinehub.co/sign",
];

export type IosShortcutOptions = {
  baseUrl: string;
  token: string;
  askCategory: boolean;
  askCard: boolean;
  askMerchant: boolean;
  askNotes: boolean;
};

type PlistValue =
  | string
  | number
  | boolean
  | PlistValue[]
  | { [key: string]: PlistValue };

function newUuid(): string {
  return randomUUID().toUpperCase();
}

function tokenString(
  text: string,
  attachments?: Record<string, PlistValue>
): PlistValue {
  const value: { [key: string]: PlistValue } = { string: text };
  if (attachments) {
    value.attachmentsByRange = attachments;
  }
  return {
    Value: value,
    WFSerializationType: "WFTextTokenString",
  };
}

function magic(outputUuid: string, outputName: string): PlistValue {
  return tokenString(OBJECT_REPLACEMENT, {
    "{0, 1}": {
      OutputName: outputName,
      OutputUUID: outputUuid,
      Type: "ActionOutput",
    },
  });
}

function magicAttachment(outputUuid: string, outputName: string): PlistValue {
  return {
    Value: {
      OutputName: outputName,
      OutputUUID: outputUuid,
      Type: "ActionOutput",
    },
    WFSerializationType: "WFTextTokenAttachment",
  };
}

function joined(prefixUuid: string, prefixName: string, suffix: string): PlistValue {
  return tokenString(OBJECT_REPLACEMENT + suffix, {
    "{0, 1}": {
      OutputName: prefixName,
      OutputUUID: prefixUuid,
      Type: "ActionOutput",
    },
  });
}

function bearer(tokenUuid: string): PlistValue {
  return tokenString(`Bearer ${OBJECT_REPLACEMENT}`, {
    "{7, 1}": {
      OutputName: "Token",
      OutputUUID: tokenUuid,
      Type: "ActionOutput",
    },
  });
}

function dictItem(key: string, value: PlistValue): PlistValue {
  return {
    WFItemType: 0,
    WFKey: tokenString(key),
    WFValue: { Value: value },
  };
}

function dictionaryField(items: PlistValue[]): PlistValue {
  return {
    Value: { WFDictionaryFieldValueItems: items },
    WFSerializationType: "WFDictionaryFieldValue",
  };
}

function authHeaders(tokenUuid: string): PlistValue {
  return dictionaryField([
    dictItem("Authorization", bearer(tokenUuid)),
    dictItem("Accept", tokenString("application/json")),
  ]);
}

function action(
  identifier: string,
  params: { [key: string]: PlistValue }
): PlistValue {
  if (params.UUID === undefined) {
    params.UUID = newUuid();
  }
  return {
    WFWorkflowActionIdentifier: identifier,
    WFWorkflowActionParameters: params,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function toPlistXml(value: PlistValue): string {
  if (typeof value === "boolean") {
    return value ? "<true/>" : "<false/>";
  }
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? `<integer>${value}</integer>`
      : `<real>${value}</real>`;
  }
  if (typeof value === "string") {
    return `<string>${escapeXml(value)}</string>`;
  }
  if (Array.isArray(value)) {
    return `<array>${value.map(toPlistXml).join("")}</array>`;
  }
  const entries = Object.entries(value).filter(([, nested]) => nested !== undefined);
  return `<dict>${entries
    .map(([key, nested]) => `<key>${escapeXml(key)}</key>${toPlistXml(nested)}`)
    .join("")}</dict>`;
}

function workflowXml(workflow: PlistValue): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
    `<plist version="1.0">\n${toPlistXml(workflow)}\n</plist>\n`
  );
}

function getContentsOfUrl(params: {
  uuid: string;
  outputName: string;
  method: "GET" | "POST";
  url: PlistValue;
  tokenUuid: string;
  jsonValues?: PlistValue;
}): PlistValue {
  const parameters: { [key: string]: PlistValue } = {
    UUID: params.uuid,
    CustomOutputName: params.outputName,
    Advanced: true,
    ShowHeaders: true,
    WFHTTPMethod: params.method,
    WFURL: params.url,
    WFHTTPHeaders: authHeaders(params.tokenUuid),
  };
  if (params.method === "POST") {
    parameters.WFHTTPBodyType = "JSON";
    if (params.jsonValues) {
      parameters.WFJSONValues = params.jsonValues;
    }
  }
  return action("is.workflow.actions.downloadurl", parameters);
}

export function buildIosShortcutWorkflow(
  options: IosShortcutOptions
): PlistValue {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const baseUuid = newUuid();
  const tokenUuid = newUuid();
  const amountUuid = newUuid();
  const merchantUuid = newUuid();
  const notesUuid = newUuid();
  const categoriesUrlUuid = newUuid();
  const categoriesDictUuid = newUuid();
  const categoryNamesUuid = newUuid();
  const categoryUuid = newUuid();
  const cardsUrlUuid = newUuid();
  const cardsDictUuid = newUuid();
  const cardNamesUuid = newUuid();
  const cardUuid = newUuid();
  const postUuid = newUuid();
  const resultDictUuid = newUuid();
  const messageUuid = newUuid();

  const promptParts = ["amount"];
  if (options.askCategory) promptParts.push("category");
  if (options.askCard) promptParts.push("card");
  if (options.askMerchant) promptParts.push("merchant");
  if (options.askNotes) promptParts.push("notes");

  const actions: PlistValue[] = [
    action("is.workflow.actions.comment", {
      WFCommentActionText:
        "Logs a purchase to Finance. The Text actions below hold your app URL and API token — leave them as-is.\n\n" +
        `Each run asks for: ${promptParts.join(" → ")}.`,
    }),
    action("is.workflow.actions.gettext", {
      UUID: baseUuid,
      CustomOutputName: "Base URL",
      WFTextActionText: tokenString(baseUrl),
    }),
    action("is.workflow.actions.gettext", {
      UUID: tokenUuid,
      CustomOutputName: "Token",
      WFTextActionText: tokenString(options.token),
    }),
    action("is.workflow.actions.ask", {
      UUID: amountUuid,
      CustomOutputName: "Amount",
      WFAskActionPrompt: "How much did it cost?",
      WFInputType: "Number",
    }),
  ];

  if (options.askMerchant) {
    actions.push(
      action("is.workflow.actions.ask", {
        UUID: merchantUuid,
        CustomOutputName: "Merchant",
        WFAskActionPrompt: "Merchant (leave empty if none)",
        WFInputType: "Text",
      })
    );
  }

  if (options.askNotes) {
    actions.push(
      action("is.workflow.actions.ask", {
        UUID: notesUuid,
        CustomOutputName: "Notes",
        WFAskActionPrompt: "Notes (leave empty if none)",
        WFInputType: "Text",
      })
    );
  }

  if (options.askCategory) {
    actions.push(
      getContentsOfUrl({
        uuid: categoriesUrlUuid,
        outputName: "Categories response",
        method: "GET",
        url: joined(baseUuid, "Base URL", "/api/categories"),
        tokenUuid,
      }),
      action("is.workflow.actions.detect.dictionary", {
        UUID: categoriesDictUuid,
        CustomOutputName: "Categories dictionary",
        WFInput: magicAttachment(categoriesUrlUuid, "Categories response"),
      }),
      action("is.workflow.actions.getvalueforkey", {
        UUID: categoryNamesUuid,
        CustomOutputName: "Category names",
        WFDictionaryKey: "names",
        WFInput: magicAttachment(categoriesDictUuid, "Categories dictionary"),
      }),
      action("is.workflow.actions.choosefromlist", {
        UUID: categoryUuid,
        CustomOutputName: "Category",
        WFChooseFromListPrompt: "Category",
        WFInput: magicAttachment(categoryNamesUuid, "Category names"),
      })
    );
  }

  if (options.askCard) {
    actions.push(
      getContentsOfUrl({
        uuid: cardsUrlUuid,
        outputName: "Cards response",
        method: "GET",
        url: joined(baseUuid, "Base URL", "/api/payment-methods"),
        tokenUuid,
      }),
      action("is.workflow.actions.detect.dictionary", {
        UUID: cardsDictUuid,
        CustomOutputName: "Cards dictionary",
        WFInput: magicAttachment(cardsUrlUuid, "Cards response"),
      }),
      action("is.workflow.actions.getvalueforkey", {
        UUID: cardNamesUuid,
        CustomOutputName: "Card names",
        WFDictionaryKey: "names",
        WFInput: magicAttachment(cardsDictUuid, "Cards dictionary"),
      }),
      action("is.workflow.actions.choosefromlist", {
        UUID: cardUuid,
        CustomOutputName: "Card",
        WFChooseFromListPrompt: "Card",
        WFInput: magicAttachment(cardNamesUuid, "Card names"),
      })
    );
  }

  const jsonItems: PlistValue[] = [
    dictItem("amount", magic(amountUuid, "Amount")),
  ];
  if (options.askCategory) {
    jsonItems.push(dictItem("category", magic(categoryUuid, "Category")));
  }
  if (options.askCard) {
    jsonItems.push(dictItem("paymentMethod", magic(cardUuid, "Card")));
  }
  if (options.askMerchant) {
    jsonItems.push(dictItem("merchant", magic(merchantUuid, "Merchant")));
  }
  if (options.askNotes) {
    jsonItems.push(dictItem("notes", magic(notesUuid, "Notes")));
  }

  actions.push(
    getContentsOfUrl({
      uuid: postUuid,
      outputName: "Purchase response",
      method: "POST",
      url: joined(baseUuid, "Base URL", "/api/quick-purchase"),
      tokenUuid,
      jsonValues: dictionaryField(jsonItems),
    }),
    action("is.workflow.actions.detect.dictionary", {
      UUID: resultDictUuid,
      CustomOutputName: "Purchase dictionary",
      WFInput: magicAttachment(postUuid, "Purchase response"),
    }),
    action("is.workflow.actions.getvalueforkey", {
      UUID: messageUuid,
      CustomOutputName: "Message",
      WFDictionaryKey: "message",
      WFInput: magicAttachment(resultDictUuid, "Purchase dictionary"),
    }),
    action("is.workflow.actions.notification", {
      WFNotificationActionTitle: "Purchase logged",
      WFNotificationActionBody: magic(messageUuid, "Message"),
    }),
    action("is.workflow.actions.showresult", {
      Text: magic(messageUuid, "Message"),
    })
  );

  return {
    WFWorkflowClientVersion: "3306.0.4",
    WFWorkflowClientRelease: "26.0",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: "900",
    WFWorkflowTypes: ["NCWidget", "WatchKit"],
    WFQuickActionSurfaces: [],
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: 4292093695,
      WFWorkflowIconGlyphNumber: 59511,
    },
    WFWorkflowImportQuestions: [],
    WFWorkflowInputContentItemClasses: [],
    WFWorkflowOutputContentItemClasses: [],
    WFWorkflowHasShortcutInputVariables: false,
    WFWorkflowHasOutputFallback: false,
    WFWorkflowActions: actions,
  };
}

export async function signIosShortcut(workflow: PlistValue): Promise<Buffer> {
  const xml = workflowXml(workflow);
  const payload = JSON.stringify({
    shortcutName: "Log Purchase",
    shortcut: xml,
  });
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "cherri/1.2",
    Origin: "https://routinehub.co",
    Referer: "https://routinehub.co/",
    Accept: "*/*",
  };

  let lastError = "Signing service did not respond.";
  for (const url of HUBSIGN_ENDPOINTS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(45_000),
      });
      const data = Buffer.from(await response.arrayBuffer());
      if (response.ok && data.subarray(0, 4).toString() === "AEA1") {
        return data;
      }
      lastError = `${url} returned HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`Could not sign the iPhone Shortcut. ${lastError}`);
}
