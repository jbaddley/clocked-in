import { createServer } from "node:http";

const messages = [];
const port = Number(process.env.MAIL_SINK_PORT || 5399);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "POST" && url.pathname === "/emails") {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const to = Array.isArray(body.to) ? body.to[0] : body.to;
    messages.push({ to, subject: body.subject, text: body.text });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "mail-sink" }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/emails") {
    const to = url.searchParams.get("to");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(messages.filter((message) => message.to === to)));
    return;
  }

  response.writeHead(404);
  response.end();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mail sink listening on http://127.0.0.1:${port}/emails`);
});
