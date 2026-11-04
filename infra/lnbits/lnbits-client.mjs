// A small LNbits API client shared by the labs. It uses only Node.js built-ins.
export class LNbits {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = "";
  }

  async request(method, path, { body, apiKey } = {}) {
    const headers = { "content-type": "application/json" };
    if (this.cookie) headers.cookie = this.cookie;
    if (apiKey) headers["x-api-key"] = apiKey;
    const res = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new Error(`LNbits ${method} ${path} failed with HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return { data, res };
  }

  // Poll until LNbits answers. Throws a clear message on timeout.
  async waitUntilHealthy(timeoutSeconds = 90) {
    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${this.baseUrl}/api/v1/health`, { redirect: "manual" });
        // Before the first install, LNbits answers with a redirect. That also means it is up.
        if (res.status < 500) return;
      } catch {
        // Not up yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`LNbits did not answer at ${this.baseUrl} within ${timeoutSeconds} seconds.`);
  }

  saveCookie(res) {
    const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
    if (cookies.length) this.cookie = cookies.join("; ");
  }

  // Create the admin account the first time, and log in every time after that.
  async loginOrInstall(username, password) {
    const probe = await fetch(`${this.baseUrl}/api/v1/health`, { redirect: "manual" });
    if (probe.status >= 300 && probe.status < 400) {
      const { res } = await this.request("PUT", "/api/v1/auth/first_install", {
        body: { username, password, password_repeat: password },
      });
      this.saveCookie(res);
      return;
    }
    const { res } = await this.request("POST", "/api/v1/auth", { body: { username, password } });
    this.saveCookie(res);
  }

  async account() {
    return (await this.request("GET", "/api/v1/auth")).data;
  }

  // Install one exact extension version from the official catalog, then turn it on.
  async installExtension({ id, version, archive }) {
    await this.request("POST", "/api/v1/extension", {
      body: {
        ext_id: id,
        archive,
        source_repo: "https://raw.githubusercontent.com/lnbits/lnbits-extensions/main/extensions.json",
        version,
      },
    });
    await this.request("PUT", `/api/v1/extension/${id}/activate`);
    await this.request("PUT", `/api/v1/extension/${id}/enable`);
  }

  async restartExtension(id) {
    await this.request("PUT", `/api/v1/extension/${id}/deactivate`);
    await this.request("PUT", `/api/v1/extension/${id}/activate`);
  }

  async wallets() {
    return (await this.account()).wallets;
  }

  async findOrCreateWallet(name) {
    const existing = (await this.wallets()).find((w) => w.name === name);
    if (existing) return existing;
    return (await this.request("POST", "/api/v1/wallet", { body: { name } })).data;
  }

  async balanceSats(wallet) {
    const { data } = await this.request("GET", "/api/v1/wallet", { apiKey: wallet.inkey });
    return Math.floor(data.balance / 1000);
  }

  async createInvoice(wallet, amount, memo) {
    const { data } = await this.request("POST", "/api/v1/payments", {
      apiKey: wallet.inkey,
      body: { out: false, amount, memo },
    });
    return data;
  }
}
