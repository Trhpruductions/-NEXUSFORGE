import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultBaseUrl = "https://www.nexusforge.app";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function getArgValue(flag) {
	const index = process.argv.indexOf(flag);
	if (index < 0 || index + 1 >= process.argv.length) {
		return null;
	}
	return process.argv[index + 1];
}

function hasFlag(flag) {
	return process.argv.includes(flag);
}

function fail(message) {
	console.error(`[desktop-update-validate] FAIL: ${message}`);
	process.exit(1);
}

function ensureSuccessStatus(status, label) {
	if (status < 200 || status >= 300) {
		fail(`${label} returned HTTP ${status}`);
	}
}

function ensureNotHtml(contentType, label) {
	const value = String(contentType || "").toLowerCase();
	if (value.includes("text/html")) {
		fail(`${label} returned HTML (${value}), expected update artifact content`);
	}
}

async function head(url, label) {
	const response = await request(url, "HEAD");
	ensureSuccessStatus(response.status, label);
	return response;
}

async function get(url, label) {
	const response = await request(url, "GET");
	ensureSuccessStatus(response.status, label);
	return response;
}

function requestOnce(url, method, insecureTls) {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const isHttps = parsed.protocol === "https:";
		const transport = isHttps ? https : http;

		const requestOptions = {
			method,
			protocol: parsed.protocol,
			hostname: parsed.hostname,
			port: parsed.port || undefined,
			path: `${parsed.pathname}${parsed.search}`,
			headers: {
				"cache-control": "no-store",
				pragma: "no-cache",
			},
			timeout: 30000,
			rejectUnauthorized: !insecureTls,
		};

		const req = transport.request(requestOptions, (res) => {
			const chunks = [];
			res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
			res.on("end", () => {
				resolve({
					status: Number(res.statusCode || 0),
					headers: res.headers,
					body: Buffer.concat(chunks).toString("utf8"),
				});
			});
		});

		req.on("timeout", () => {
			req.destroy(new Error(`Request timed out: ${method} ${url}`));
		});

		req.on("error", reject);
		req.end();
	});
}

async function request(url, method, redirectCount = 0) {
	const insecureTls = hasFlag("--insecure") || process.env.NEXUSFORGE_UPDATE_VALIDATE_INSECURE === "true";
	const response = await requestOnce(url, method, insecureTls);

	const status = response.status;
	const location = Array.isArray(response.headers.location)
		? response.headers.location[0]
		: response.headers.location;

	if (status >= 300 && status < 400 && location) {
		if (redirectCount >= 5) {
			fail(`Too many redirects for ${method} ${url}`);
		}
		const nextUrl = new URL(location, url).toString();
		return request(nextUrl, method, redirectCount + 1);
	}

	return response;
}

function resolveManifestUrlCandidate(candidateUrl, manifestUrl) {
	const raw = String(candidateUrl || "").trim();
	if (!raw) {
		return null;
	}

	try {
		return new URL(raw, manifestUrl).toString();
	} catch {
		return null;
	}
}

function resolveBaseUrlFromDownloadUrl(downloadUrl) {
	const candidate = String(downloadUrl || "").trim();
	if (!candidate) {
		return "";
	}

	try {
		const parsed = new URL(candidate);
		const pathname = String(parsed.pathname || "");
		if (!pathname || pathname === "/") {
			parsed.pathname = "/";
		} else {
			const lastSlashIndex = pathname.lastIndexOf("/");
			parsed.pathname = lastSlashIndex <= 0 ? "/" : pathname.slice(0, lastSlashIndex + 1);
		}
		parsed.search = "";
		parsed.hash = "";
		return parsed.toString().replace(/\/+$/, "");
	} catch {
		return "";
	}
}

function getWorkspaceManifestBaseUrl() {
	const manifestPath = path.resolve(scriptDir, "../apps/web/public/desktop-update.json");
	if (!fs.existsSync(manifestPath)) {
		return "";
	}

	try {
		const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
		const folderUrl = String(parsed.downloadFolderUrl || "").trim();
		if (folderUrl) {
			return folderUrl.replace(/\/+$/, "");
		}

		return resolveBaseUrlFromDownloadUrl(parsed.downloadUrl);
	} catch {
		return "";
	}
}

async function main() {
	const rawBase =
		getArgValue("--base") ||
		process.env.NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL ||
		getWorkspaceManifestBaseUrl() ||
		defaultBaseUrl;
	const baseUrl = String(rawBase || "").trim().replace(/\/+$/, "");
	const manifestUrl = `${baseUrl}/desktop-update.json`;

	console.log(`[desktop-update-validate] Base URL: ${baseUrl}`);

	const manifestHead = await head(manifestUrl, "Manifest HEAD");
	const manifestContentType = String(manifestHead.headers["content-type"] || "");
	ensureNotHtml(manifestContentType, "Manifest HEAD");
	if (!manifestContentType.toLowerCase().includes("application/json")) {
		fail(`Manifest HEAD returned unexpected content-type: ${manifestContentType}`);
	}

	const manifestResponse = await get(manifestUrl, "Manifest GET");

	const manifestGetContentType = String(manifestResponse.headers["content-type"] || "");
	ensureNotHtml(manifestGetContentType, "Manifest GET");

	let manifest;
	try {
		manifest = JSON.parse(manifestResponse.body);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		fail(`Manifest JSON parse failed: ${message}`);
	}

	const version = String(manifest.version || "").trim();
	const rawDownloadUrl = String(manifest.downloadUrl || "").trim();
	const downloadUrl = resolveManifestUrlCandidate(rawDownloadUrl, manifestUrl);
	const sha256 = String(manifest.sha256 || "").trim();

	if (!version) {
		fail("Manifest is missing version");
	}
	if (!rawDownloadUrl) {
		fail("Manifest is missing downloadUrl");
	}
	if (!downloadUrl) {
		fail("Manifest downloadUrl is invalid or could not be resolved");
	}
	if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
		fail("Manifest sha256 is missing or invalid");
	}

	const installerHead = await head(downloadUrl, "Installer HEAD");
	const installerContentType = String(installerHead.headers["content-type"] || "");
	ensureNotHtml(installerContentType, "Installer HEAD");
	if (!installerContentType.toLowerCase().includes("application/octet-stream")) {
		console.warn(
			`[desktop-update-validate] WARN: Installer content-type is '${installerContentType}', expected application/octet-stream`,
		);
	}

	const contentLengthText = String(installerHead.headers["content-length"] || "0");
	const contentLength = Number(contentLengthText);
	if (!Number.isFinite(contentLength) || contentLength < 1024 * 1024) {
		fail(`Installer content-length looks invalid (${contentLengthText})`);
	}

	console.log("[desktop-update-validate] PASS");
	console.log(`[desktop-update-validate] Version: ${version}`);
	console.log(`[desktop-update-validate] Manifest: ${manifestUrl}`);
	console.log(`[desktop-update-validate] Installer: ${downloadUrl}`);
	console.log(`[desktop-update-validate] SHA256: ${sha256}`);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	fail(message);
});
