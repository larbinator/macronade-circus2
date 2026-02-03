var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs/promises";
var assetCategories = [
    { id: "pantins", label: "Pantins", dir: "pantins" },
    { id: "decors", label: "Decors", dir: "decors" },
    { id: "objets", label: "Objets", dir: "objets" },
];
var assetExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
var humanize = function (name) {
    return name
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
};
var parseAttributes = function (raw) {
    var _a, _b;
    var attributes = {};
    var regex = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    var match = null;
    while ((match = regex.exec(raw))) {
        attributes[match[1]] = (_b = (_a = match[2]) !== null && _a !== void 0 ? _a : match[3]) !== null && _b !== void 0 ? _b : "";
    }
    return attributes;
};
var parsePantinSvg = function (contents) {
    var _a;
    var rotatable = new Set();
    var variants = {};
    var tagRegex = /<g\b[^>]*>/gi;
    var match = null;
    while ((match = tagRegex.exec(contents))) {
        var attrs = parseAttributes(match[0]);
        if (attrs["data-isrotatable"] === "true" || attrs["data-isrotatable"] === "1") {
            var id = attrs.id.trim();
            if (id) {
                rotatable.add(id);
            }
        }
        var variantGroup = attrs["data-variant-groupe"];
        var variantName = attrs["data-variant-name"];
        if (variantGroup && variantName) {
            var visibility = ((_a = attrs.visibility) !== null && _a !== void 0 ? _a : "").toLowerCase();
            var isVisible = visibility === "true" || visibility === "visible";
            if (!variants[variantGroup]) {
                variants[variantGroup] = { variants: [], defaultVariant: undefined };
            }
            variants[variantGroup].variants.push({ name: variantName, visible: isVisible });
            if (isVisible && !variants[variantGroup].defaultVariant) {
                variants[variantGroup].defaultVariant = variantName;
            }
        }
    }
    return {
        rotatableMembers: Array.from(rotatable),
        variants: variants,
    };
};
var generateAssetsManifest = function () { return __awaiter(void 0, void 0, void 0, function () {
    var publicDir, categories, manifestPath;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                publicDir = path.resolve(__dirname, "public");
                return [4 /*yield*/, Promise.all(assetCategories.map(function (category) { return __awaiter(void 0, void 0, void 0, function () {
                        var dirPath, entries, _a, items;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    dirPath = path.join(publicDir, category.dir);
                                    entries = [];
                                    _b.label = 1;
                                case 1:
                                    _b.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, fs.readdir(dirPath, { withFileTypes: true })];
                                case 2:
                                    entries = _b.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    _a = _b.sent();
                                    entries = [];
                                    return [3 /*break*/, 4];
                                case 4:
                                    items = entries
                                        .filter(function (entry) { return entry.isFile(); })
                                        .map(function (entry) { return entry.name; })
                                        .filter(function (name) { return assetExtensions.has(path.extname(name).toLowerCase()); })
                                        .sort(function (a, b) { return a.localeCompare(b); })
                                        .map(function (name) {
                                        var ext = path.extname(name).toLowerCase();
                                        var base = path.basename(name, ext);
                                        return {
                                            id: base,
                                            label: humanize(base),
                                            path: "/".concat(category.dir, "/").concat(name),
                                            type: ext.slice(1),
                                        };
                                    });
                                    return [2 /*return*/, {
                                            id: category.id,
                                            label: category.label,
                                            items: items,
                                        }];
                            }
                        });
                    }); }))];
            case 1:
                categories = _a.sent();
                manifestPath = path.join(publicDir, "assets-manifest.json");
                return [4 /*yield*/, fs.writeFile(manifestPath, JSON.stringify({ categories: categories }, null, 2))];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var generatePantinsManifest = function () { return __awaiter(void 0, void 0, void 0, function () {
    var publicDir, pantinsDir, entries, _a, pantins, manifestPath;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                publicDir = path.resolve(__dirname, "public");
                pantinsDir = path.join(publicDir, "pantins");
                entries = [];
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, fs.readdir(pantinsDir, { withFileTypes: true })];
            case 2:
                entries = _b.sent();
                return [3 /*break*/, 4];
            case 3:
                _a = _b.sent();
                entries = [];
                return [3 /*break*/, 4];
            case 4: return [4 /*yield*/, Promise.all(entries
                    .filter(function (entry) { return entry.isFile() && entry.name.toLowerCase().endsWith(".svg"); })
                    .sort(function (a, b) { return a.name.localeCompare(b.name); })
                    .map(function (entry) { return __awaiter(void 0, void 0, void 0, function () {
                    var filePath, contents, parsed, id;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                filePath = path.join(pantinsDir, entry.name);
                                return [4 /*yield*/, fs.readFile(filePath, "utf8")];
                            case 1:
                                contents = _a.sent();
                                parsed = parsePantinSvg(contents);
                                id = path.basename(entry.name, path.extname(entry.name));
                                return [2 /*return*/, {
                                        id: id,
                                        path: "/pantins/".concat(entry.name),
                                        rotatableMembers: parsed.rotatableMembers,
                                        variants: parsed.variants,
                                    }];
                        }
                    });
                }); }))];
            case 5:
                pantins = _b.sent();
                manifestPath = path.join(publicDir, "pantins-manifest.json");
                return [4 /*yield*/, fs.writeFile(manifestPath, JSON.stringify({ pantins: pantins }, null, 2))];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); };
var assetsManifestPlugin = function () {
    var timer = null;
    var schedule = function (onReload) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(function () {
            Promise.all([generateAssetsManifest(), generatePantinsManifest()])
                .then(function () {
                if (onReload) {
                    onReload();
                }
            })
                .catch(function (error) {
                console.warn("[assets-manifest] Failed to generate manifest", error);
            });
        }, 50);
    };
    return {
        name: "assets-manifest",
        buildStart: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, Promise.all([generateAssetsManifest(), generatePantinsManifest()])];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        configResolved: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, Promise.all([generateAssetsManifest(), generatePantinsManifest()])];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        configureServer: function (server) {
            var publicDir = path.resolve(__dirname, "public");
            var watchDirs = assetCategories.map(function (category) { return path.join(publicDir, category.dir); });
            var watchRoots = watchDirs.map(function (dir) { return path.resolve(dir); });
            var isWatchedPath = function (file) {
                return watchRoots.some(function (root) { return file === root || file.startsWith("".concat(root).concat(path.sep)); });
            };
            server.watcher.add(watchDirs);
            var onFsEvent = function (file) {
                if (!isWatchedPath(file)) {
                    return;
                }
                schedule(function () {
                    server.ws.send({ type: "full-reload", path: "/assets-manifest.json" });
                });
            };
            server.watcher.on("add", onFsEvent);
            server.watcher.on("unlink", onFsEvent);
            server.watcher.on("change", onFsEvent);
        },
    };
};
var host = process.env.TAURI_DEV_HOST;
// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        assetsManifestPlugin(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host: host,
                port: 1421,
            }
            : undefined,
        watch: {
            // 3. tell Vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**", "**/dist/**"],
            awaitWriteFinish: {
                stabilityThreshold: 200,
                pollInterval: 50,
            },
        },
    },
});
