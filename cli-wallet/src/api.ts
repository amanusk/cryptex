const rp = require("request-promise");
const Chains = {
  columbus_3: "https://fcd.terra.dev/v1",
  soju: "https://soju-fcd.terra.dev/v1",
};

const SERVER_URL = "http://192.168.1.165:8080/";

export async function get(route: string, body: any): Promise<any> {
  console.log(`${SERVER_URL}${route}`);
  return rp({
    method: "GET",
    uri: `${SERVER_URL}${route}`,
    body,
    json: true,
  });
}

export async function post(route: string, body: any): Promise<any> {
  console.log(`${route}${route}`);
  console.log(JSON.stringify(body));
  return rp({
    method: "POST",
    uri: `${SERVER_URL}${route}`,
    body,
    json: true,
  });
}
