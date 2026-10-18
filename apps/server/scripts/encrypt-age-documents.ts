/**
 * One-off: encrypt age-verification ID documents that were stored before encryption at rest.
 *
 *   npx tsx scripts/encrypt-age-documents.ts            dry run: counts what would change, writes nothing
 *   npx tsx scripts/encrypt-age-documents.ts --apply    encrypts the plain files in place
 *   ... --dir <folder>                                  another folder (default: var/age-documents)
 *
 * Run from apps/server, on the machine that holds the documents, with the same .env as the API
 * (the key comes from AGE_DOCUMENT_ENCRYPTION_KEY, or is derived from JWT_REFRESH_SECRET). If the
 * API later runs with a different key, documents encrypted now can't be opened, so set the
 * dedicated key first if you mean to. Files already encrypted are left alone, so running it twice
 * is safe. It never prints or copies a document's contents, only counts and file names.
 *
 * Production use needs the owner's go-ahead. Take a backup of the folder first.
 */
import { ageDocumentDir, encryptPlainDocuments } from "../src/lib/age-verification.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dirFlag = args.indexOf("--dir");
const dir = dirFlag >= 0 && args[dirFlag + 1] ? args[dirFlag + 1] : ageDocumentDir;

const report = await encryptPlainDocuments(dir, { apply });
console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      folder: dir,
      filesChecked: report.scanned,
      [apply ? "encrypted" : "wouldEncrypt"]: report.encrypted,
      alreadyEncrypted: report.alreadyEncrypted,
      ignored: report.skipped,
      failed: report.failed,
    },
    null,
    2,
  ),
);
if (!apply && report.encrypted > 0) console.log("Dry run only. Run again with --apply to encrypt these files.");
process.exitCode = report.failed.length ? 1 : 0;
