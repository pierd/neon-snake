// src/index.ts
import { detectDupes } from "@liveblocks/core";

// src/version.ts
var PKG_NAME = "@liveblocks/client";
var PKG_VERSION = "3.24.1";
var PKG_FORMAT = "esm";

// src/index.ts
import {
  createClient,
  defineAiTool,
  FeedRequestErrorCode,
  getMentionsFromCommentBody,
  isNotificationChannelEnabled,
  LiveblocksError,
  LiveFile,
  LiveList,
  LiveMap,
  LiveObject,
  LiveText,
  nanoid,
  shallow,
  stringifyCommentBody,
  toPlainLson
} from "@liveblocks/core";
detectDupes(PKG_NAME, PKG_VERSION, PKG_FORMAT);
export {
  FeedRequestErrorCode,
  LiveFile,
  LiveList,
  LiveMap,
  LiveObject,
  LiveText,
  LiveblocksError,
  createClient,
  defineAiTool,
  getMentionsFromCommentBody,
  isNotificationChannelEnabled,
  nanoid,
  shallow,
  stringifyCommentBody,
  toPlainLson
};
//# sourceMappingURL=index.js.map