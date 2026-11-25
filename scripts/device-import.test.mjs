import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("importa aparelhos antigos e novos com crédito em mil, sem duplicar clientes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "device-import-"));
  try {
    const headers = ["COD_CLIENTE", "SITUACAO_RECEITA", "FLG_MEI", "REC_MOVEL", "MOVEL",
      "FLG_COBERTURA", "TP_PRODUTO", "FIXA_BASICA", "DIGITAL_1", "AVANCADOS",
      "VIVO_TECH", "APARELHOS", "QT_AVANCADA_DADOS", "QT_MOVEL_TERM", "NOMEREDE"];
    const current = (model, credit) => "Aparelho atual do cliente: " + model + ", compatível com Vivo Satélite. Crédito de até R$ " + credit + ".";
    const cases = [
      ["1", "Capacidade de Pagamento de R$30.000 para iPhone", "Renovação de Móvel"],
      ["2", current("Samsung Galaxy S25", "16 mil")],
      ["3", current("Samsung Galaxy Z Fold6", "25 mil"), "Renovação de Móvel"],
      ["3", current("Samsung Galaxy Z Fold6", "25 mil")],
      ["4", "Aquisição de aparelhos. Crédito de até R$ 8 mil."],
      ["5", current("Samsung Galaxy S24", "1,5 mil")],
      ["6", current("iPhone", "99 mil"), "", "8 - BAIXADA"],
      ["7", "Aparelho atual do cliente: iPhone, compatível com Vivo Satélite."],
      ["8", current("iPhone", "0 mil")],
      ["9", "Capacidade de Pagamento de R$1.234,56 para Galaxy S26"],
      ["10", current("iPhone", "2,5 mil")],
      ["1", current("Motorola", "1 mil")],
    ];
    const rows = cases.map(([id, device, renewal = "", status = "2 - ATIVA"]) => {
      const row = { COD_CLIENTE: id, APARELHOS: device, REC_MOVEL: renewal,
        SITUACAO_RECEITA: status, NOMEREDE: "Teste" };
      return headers.map((key) => row[key] ?? "").join(";");
    });
    const input = path.join(directory, "source.csv");
    const output = path.join(directory, "snapshot.json");
    await writeFile(input, [headers.join(";"), ...rows].join(String.fromCharCode(10)));
    execFileSync(process.execPath, ["scripts/process-mapa-parque-all.mjs", input, output], { stdio: "pipe" });
    const snapshot = JSON.parse(await readFile(output, "utf8"));
    for (const data of [snapshot, ...Object.values(snapshot.scopes)]) {
      const kpi = data.opportunities;
      assert.equal(kpi.devices, 7);
      assert.equal(kpi.deviceIphone, 2);
      assert.equal(kpi.deviceGalaxyPremium, 3);
      assert.equal(kpi.deviceOther, 2);
      assert.equal(kpi.mobileRenewalWithDevice, 2);
      assert.equal(kpi.devicesWithoutMobileRenewal, 5);
      assert.ok(Math.abs(kpi.deviceCredit - 84234.56) < 0.001);
      assert.equal(kpi.deviceIphone + kpi.deviceGalaxyPremium + kpi.deviceOther, kpi.devices);
      assert.equal(kpi.mobileRenewalWithDevice + kpi.devicesWithoutMobileRenewal, kpi.devices);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
