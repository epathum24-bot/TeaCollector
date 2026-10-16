const TOKEN_KEY = "teacollector-token";
export const session = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};
export async function api(path, method = "GET", body) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session.get() ? { Authorization: `Bearer ${session.get()}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "The server returned an unexpected response." }));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const money = (cents) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
export const kg = (grams) =>
  new Intl.NumberFormat("en-LK", { maximumFractionDigits: 3 }).format(
    (grams || 0) / 1000,
  );
export const statusName = (value) =>
  ({
    pending: "Pending",
    requested: "Pending pickup",
    accepted: "Accepted",
    assigned: "Assigned",
    on_the_way: "On the way",
    collected: "Collected",
    completed: "Completed",
    rejected: "Rejected",
    cancelled: "Cancelled",
    unpaid: "Unpaid",
    paid: "Paid",
  })[value] || value;
export function downloadCSV(rows) {
  const values = [
    [
      "Request number",
      "Date",
      "Owner",
      "Company",
      "Lorry",
      "Status",
      "Estimated kg",
      "Net kg",
      "Rate LKR/kg",
      "Bill total LKR",
      "Payment status",
    ],
    ...rows.map((r) => [
      r.requestNumber,
      r.date,
      r.ownerName,
      r.companyName,
      r.vehicleNumber,
      statusName(r.status),
      r.estimatedGrams / 1000,
      r.bill ? r.bill.netGrams / 1000 : "",
      r.bill ? r.bill.pricePerKgCents / 100 : r.rateCents / 100,
      r.bill ? (r.bill.totalCents / 100).toFixed(2) : "",
      r.bill?.paymentStatus || "",
    ]),
  ];
  const escape = (value) =>
    '"' +
    String(value)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const blob = new Blob(
    ["\uFEFF" + values.map((row) => row.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tea-collections.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
