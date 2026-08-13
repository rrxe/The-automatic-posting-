import sys

path = "src/services/publish.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old1 = '''import { supabase } from "../db/supabase.js";

import {
  getTelegramClient
} from "../telegram/clientManager.js";'''

new1 = '''import { supabase } from "../db/supabase.js";

import {
  getTelegramClient,
  touchTelegramClient
} from "../telegram/clientManager.js";'''

old2 = '''        await client.sendMessage(
          inputPeer,
          {
            message:
              text
          }
        );

        cycleSuccess++;
        totalSuccess++;'''

new2 = '''        await client.sendMessage(
          inputPeer,
          {
            message:
              text
          }
        );

        touchTelegramClient(
          accountId
        );

        cycleSuccess++;
        totalSuccess++;'''

for old, new, name in [(old1, new1, "استيراد touchTelegramClient"), (old2, new2, "تحديث وقت الاستخدام بعد كل إرسال")]:
    count = content.count(old)
    if count != 1:
        print(f"FAILED: '{name}' found {count} times (expected 1). Aborting, no changes written.")
        sys.exit(1)
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("تم تحديث publish.ts بنجاح")
