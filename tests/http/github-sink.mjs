import { createServer } from "node:http";

const issues = [];
const port = Number(process.env.GITHUB_SINK_PORT || 5400);
let nextNumber = 1;

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const issuePath = /^\/repos\/[^/]+\/[^/]+\/issues(?:\/(\d+))?$/.exec(url.pathname);
  const labelPath = /^\/repos\/[^/]+\/[^/]+\/labels$/.exec(url.pathname);

  if (request.method === "POST" && issuePath && !issuePath[1]) {
    const body = await readJson(request);
    const number = nextNumber;
    nextNumber += 1;
    const ownerRepo = url.pathname.split("/").slice(2, 4).join("/");
    const issue = {
      number,
      title: body.title,
      body: body.body,
      labels: body.labels ?? [],
      state: "open",
      state_reason: null,
      html_url: `https://github.com/${ownerRepo}/issues/${number}`,
    };
    issues.push(issue);
    send(response, 201, issue);
    return;
  }

  if (request.method === "PATCH" && issuePath?.[1]) {
    const number = Number(issuePath[1]);
    const issue = issues.find((item) => item.number === number);
    if (!issue) {
      send(response, 404, { message: "Not Found" });
      return;
    }

    const body = await readJson(request);
    if (body.state) {
      issue.state = body.state;
    }

    if (body.state_reason) {
      issue.state_reason = body.state_reason;
    }

    send(response, 200, issue);
    return;
  }

  if (request.method === "POST" && labelPath) {
    send(response, 201, await readJson(request));
    return;
  }

  if (request.method === "GET" && url.pathname === "/issues") {
    send(response, 200, issues);
    return;
  }

  response.writeHead(404);
  response.end();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`github sink listening on http://127.0.0.1:${port}`);
});
