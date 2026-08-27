import http from "node:http";

const req = http.get("http://127.0.0.1:9210/api/scrape/config", (res) => {
  let body = "";
  res.on("data", (c) => (body += c));
  res.on("end", () => {
    const j = JSON.parse(body);
    const lib = j?.data?.config?.providerSettings?.javlibrary;
    console.log(
      JSON.stringify(
        {
          ok: j?.ok,
          cookieLen: lib?.cookie?.length ?? 0,
          baseUrl: lib?.baseUrl ?? "",
          proxyUrl: lib?.proxyUrl ?? "",
        },
        null,
        2,
      ),
    );
  });
});
req.on("error", (e) => {
  console.error(e.message);
  process.exit(1);
});
