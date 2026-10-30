import { readFile, readdir, writeFile } from "node:fs/promises";
import ts from "typescript";

const out = "src/lib/developer/openapi.json";
const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const canonical = (path) => path.replace(/\{[^}]+\}/g, "{}");
const routes = new Map();

async function collect(dir, segments = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      await collect(
        file,
        entry.name.startsWith("(") ? segments : [...segments, entry.name.replace(/^\[(.+)\]$/, "{$1}")],
      );
    } else if (entry.name === "route.ts") {
      const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
      const exported = new Set();
      const missing = new Set();
      for (const statement of source.statements) {
        if (
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === "@/lib/api/missing" &&
          statement.importClause?.namedBindings &&
          ts.isNamedImports(statement.importClause.namedBindings)
        ) {
          for (const element of statement.importClause.namedBindings.elements) missing.add(element.name.text);
        }
      }
      for (const statement of source.statements) {
        if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          if (
            statement.moduleSpecifier &&
            ts.isStringLiteral(statement.moduleSpecifier) &&
            statement.moduleSpecifier.text === "@/lib/api/missing"
          )
            continue;
          for (const element of statement.exportClause.elements) {
            if (!missing.has((element.propertyName ?? element.name).text)) exported.add(element.name.text);
          }
        } else if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
          if (ts.isFunctionDeclaration(statement) && statement.name) exported.add(statement.name.text);
          if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
              if (ts.isIdentifier(declaration.name)) exported.add(declaration.name.text);
            }
          }
        }
      }
      let path = `/${segments.join("/")}`;
      if (path === "/mcp" || path.startsWith("/brand/") || path.startsWith("/webhooks/")) continue;
      if (path === "/api/feedback" || path.startsWith("/api/feedback/")) path = path.slice(4);
      if (exported.size === 0) continue;
      routes.set(canonical(path), {
        path,
        methods: [...exported].filter((method) => methods.has(method)).map((method) => method.toLowerCase()),
      });
    }
  }
}

await collect("src/app");
const document = JSON.parse(await readFile(out, "utf8"));
const write = process.argv.includes("--write");
const errors = [];
for (const [path, operations] of Object.entries(document.paths)) {
  for (const method of Object.keys(operations).filter((key) => methods.has(key.toUpperCase()))) {
    if (!routes.get(canonical(path))?.methods.includes(method)) {
      if (write) delete operations[method];
      else errors.push(`No Next.js handler for ${method.toUpperCase()} ${path}`);
    }
  }
  if (write && !Object.keys(operations).some((key) => methods.has(key.toUpperCase()))) delete document.paths[path];
}
for (const route of routes.values()) {
  let documentedPath = Object.keys(document.paths).find((path) => canonical(path) === canonical(route.path));
  for (const method of route.methods) {
    if (!documentedPath || !document.paths[documentedPath][method]) {
      if (!write) {
        errors.push(`Undocumented Next.js handler: ${method.toUpperCase()} ${route.path}`);
        continue;
      }
      documentedPath ??= route.path;
      document.paths[documentedPath] ??= {};
      document.paths[documentedPath][method] = {
        operationId: `${method}_${route.path.replace(/[^a-zA-Z0-9]+/g, "_")}`,
        parameters: [...documentedPath.matchAll(/\{([^}]+)\}/g)].map((match) => ({
          name: match[1],
          in: "path",
          required: true,
          schema: { type: "string" },
        })),
        responses: { default: { description: "Response from the Next.js handler." } },
      };
    }
  }
}
if (write) {
  document.info.title = "Voluntime Next.js API";
  document.servers = [{ url: "/" }];
  document.components.securitySchemes.apiKeyAuth = { type: "apiKey", name: "X-Api-Key", in: "header" };
  for (const [path, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!methods.has(method.toUpperCase())) continue;
      if (!path.startsWith("/auth/") && !path.startsWith("/public/") && path !== "/health") {
        const humanOnly = path.includes("/api-keys") || path.startsWith("/users") || path.startsWith("/feedback");
        operation.security = humanOnly ? [{ bearerAuth: [] }] : [{ bearerAuth: [] }, { apiKeyAuth: [] }];
      }
    }
  }
  await writeFile(out, `${JSON.stringify(document, null, 2)}\n`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `${write ? "Updated" : "Validated"} Next.js OpenAPI snapshot (${Object.keys(document.paths).length} paths). Maintain request/response schemas in ${out}.`,
);
