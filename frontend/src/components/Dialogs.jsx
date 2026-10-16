import { money, kg } from "../api/client.js";
import { Modal, Form, Field, Badge, Brand } from "./ui.jsx";
export default function Dialogs({ modal, close, data, save }) {
  if (!modal) return null;
  const r = modal.record;
  if (modal.type === "invoice") {
    const b = r.bill;
    return (
      <Modal title="Collection bill" close={close} wide>
        <div className="invoice" id="print-invoice">
          <div className="invoice-head">
            <Brand />
            <div>
              <strong>{b.number}</strong>
              <p>{new Date(b.issuedAt).toLocaleDateString("en-GB")}</p>
              <Badge value={b.paymentStatus} />
            </div>
          </div>
          <div className="invoice-parties">
            <div>
              <span className="eyebrow">COLLECTION COMPANY</span>
              <h3>{r.companyName}</h3>
              <p>{r.companyPhone}</p>
            </div>
            <div>
              <span className="eyebrow">TEA SELLER</span>
              <h3>{r.ownerName}</h3>
              <p>{r.ownerPhone}</p>
              <p>{r.location}</p>
            </div>
          </div>
          <p className="muted">
            Collection date: {r.date} · Lorry: {r.vehicleNumber}
          </p>
          <div className="invoice-lines">
            {[
              ["Request number", r.requestNumber],
              ["Gross weight", `${kg(b.grossGrams)} kg`],
              ["Rejected weight", `${kg(b.rejectedGrams)} kg`],
              ["Other deduction", `${kg(b.otherDeductionGrams)} kg`],
              ["Net weight", `${kg(b.netGrams)} kg`],
              ["Rate per kg", money(b.pricePerKgCents)],
              ["Total amount", money(b.totalCents)],
            ].map(([a, value]) => (
              <div key={a}>
                <span>{a}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <div className="invoice-total">
              <span>Net amount</span>
              <strong>{money(b.totalCents)}</strong>
            </div>
          </div>
          {b.note && <p>Note: {b.note}</p>}
          <p className="small muted">
            Collector: {b.collectorName || b.recordedBy}. Price saved at
            collection time.
          </p>
          {b.paymentStatus === "paid" && (
            <p className="payment-note">
              Payment recorded on{" "}
              {new Date(b.paidAt).toLocaleDateString("en-GB")} · Reference:{" "}
              {b.paymentReference}
            </p>
          )}
        </div>
        <div className="form-actions no-print">
          <button className="button secondary" onClick={close}>
            Close
          </button>
          <button className="button" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </Modal>
    );
  }
  if (modal.type === "settlement") {
    const sellers = [...new Map(data.requests.map((request) => [request.ownerId, request])).values()];
    return (
      <Modal title="Create monthly payment" close={close}>
        <p className="muted">This groups unpaid completed collections for one Tea Seller and month.</p>
        <Form
          initial={{ ownerId: sellers[0]?.ownerId || "", month: data.today.slice(0, 7) }}
          submit="Create monthly payment"
          onCancel={close}
          onSubmit={(v) =>
            save("/settlements", "POST", v, "Monthly payment created.")
          }
        >
          {(bind) => (
            <>
              <Field
                label="Tea Seller"
                {...bind("ownerId")}
                options={sellers.map((seller) => ({ value: seller.ownerId, label: seller.ownerName }))}
                required
              />
              <Field label="Collection month" {...bind("month")} type="month" required />
            </>
          )}
        </Form>
      </Modal>
    );
  }
  if (modal.type === "monthlyPay") {
    const settlement = modal.record;
    return (
      <Modal title="Record monthly payment" close={close}>
        <p>
          Record payment of <strong>{money(settlement.totalCents)}</strong> to {settlement.ownerName} for {settlement.month}.
        </p>
        <Form
          initial={{ reference: "" }}
          submit="Mark monthly payment paid"
          onCancel={close}
          onSubmit={(v) =>
            save(`/settlements/${settlement.id}/pay`, "POST", v, "Monthly payment recorded.")
          }
        >
          {(bind) => (
            <Field label="Bank reference / cash receipt" {...bind("reference")} required maxLength={100} />
          )}
        </Form>
      </Modal>
    );
  }
  if (modal.type === "monthlySummary") {
    const settlement = modal.record;
    const collections = data.requests.filter((request) =>
      settlement.requestIds.includes(request.id),
    );
    const firstCollection = collections[0];
    return (
      <Modal title={`Monthly payment · ${settlement.month}`} close={close} wide className="monthly-summary-modal">
        <div className="monthly-summary-head">
          <div>
            <span className="eyebrow">{settlement.number}</span>
            <h3>{data.user.role === "company" ? settlement.ownerName : settlement.companyName}</h3>
            <p className="muted">
              {settlement.requestCount} collection days · {firstCollection?.vehicleNumber || "Lorry details unavailable"}
              {firstCollection?.bill?.collectorName && ` · ${firstCollection.bill.collectorName}`}
            </p>
          </div>
          <div className="monthly-summary-total">
            <span>Total</span>
            <strong>{money(settlement.totalCents)}</strong>
            <Badge value={settlement.status} />
          </div>
        </div>
        <div className="monthly-popup-table">
          <div className="monthly-popup-row monthly-popup-head">
            <strong>Date</strong>
            <strong>Request</strong>
            <strong>Gross</strong>
            <strong>Rejected</strong>
            <strong>Deduction</strong>
            <strong>Net</strong>
            <strong>Rate</strong>
            <strong>Amount</strong>
            <strong>Payment</strong>
          </div>
          {collections.map((request) => (
            <div className="monthly-popup-row" key={request.id}>
              <span>{request.date}</span>
              <span>{request.requestNumber}</span>
              <span>{request.bill ? `${kg(request.bill.grossGrams)} kg` : "—"}</span>
              <span>{request.bill ? `${kg(request.bill.rejectedGrams)} kg` : "—"}</span>
              <span>{request.bill ? `${kg(request.bill.otherDeductionGrams)} kg` : "—"}</span>
              <span>{request.bill ? `${kg(request.bill.netGrams)} kg` : "—"}</span>
              <span>{request.bill ? money(request.bill.pricePerKgAtCollection || request.bill.pricePerKgCents) : "—"}</span>
              <span>{request.bill ? money(request.bill.totalCents) : "—"}</span>
              <span>
                <Badge value={request.bill?.paymentStatus || request.status} />
                {request.bill?.paymentReference && (
                  <small>{request.bill.paymentReference}</small>
                )}
              </span>
            </div>
          ))}
        </div>
        {data.user.role === "company" && settlement.status === "pending" && (
          <div className="no-print">
            <Form
              initial={{ reference: "" }}
              submit="Record monthly payment"
              onCancel={close}
              onSubmit={(v) =>
                save(`/settlements/${settlement.id}/pay`, "POST", v, "Monthly payment recorded.")
              }
            >
              {(bind) => (
                <Field label="Bank reference / cash receipt" {...bind("reference")} required maxLength={100} />
              )}
            </Form>
          </div>
        )}
        <div className="form-actions no-print">
          <button className="button secondary" onClick={close}>Close</button>
          <button className="button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </Modal>
    );
  }
  if (modal.type === "request" || modal.type === "editRequest") {
    const lorry = modal.lorry;
    const company = data.companies.find((c) => c.id === lorry.companyId);
    const edit = modal.type === "editRequest";
    return (
      <Modal
        title={edit ? "Edit collection request" : "Request a collection"}
        close={close}
      >
        <div className="selected-lorry">
          <strong>
            {lorry.vehicleNumber} · {company?.name}
          </strong>
          <span>{money(r?.rateCents ?? company?.rateCents)} / kg</span>
        </div>
        <Form
          initial={{
            lorryId: lorry.id,
            date: r?.date || data.today,
            estimatedWeight: r ? r.estimatedGrams / 1000 : "",
            area: r?.area || lorry.areas[0],
            timeWindow: r?.timeWindow || "Morning",
            location: r?.location || data.user.address,
            notes: r?.notes || "",
          }}
          submit={edit ? "Save request" : "Send collection request"}
          onCancel={close}
          onSubmit={(v) =>
            save(
              edit ? `/requests/${r.id}` : "/requests",
              edit ? "PATCH" : "POST",
              v,
              edit
                ? "Request updated."
                : "Request sent directly to your selected lorry.",
            )
          }
        >
          {(bind, v) => (
            <>
              <div className="form-grid">
                <Field
                  label="Collection date"
                  {...bind("date")}
                  type="date"
                  min={data.today}
                  required
                />
                <Field
                  label="Estimated weight (kg)"
                  {...bind("estimatedWeight")}
                  type="number"
                  min="0.001"
                  max={lorry.capacityGrams / 1000}
                  step="0.001"
                  required
                />
              </div>
              <div className="form-grid">
                <Field
                  label="Collection area"
                  {...bind("area")}
                  options={lorry.areas}
                />
                <Field
                  label="Preferred time"
                  {...bind("timeWindow")}
                  options={["Morning", "Afternoon", "Any time"]}
                />
              </div>
              <Field
                label="Pickup address / directions"
                {...bind("location")}
                multiline
                required
                minLength={5}
                maxLength={500}
              />
              <Field
                label="Notes (optional)"
                {...bind("notes")}
                multiline
                maxLength={500}
              />
              <div className="notice">
                Estimated gross:{" "}
                <strong>
                  {money(
                    Math.round(
                      Number(v.estimatedWeight || 0) *
                        (r?.rateCents ?? company?.rateCents ?? 0),
                    ),
                  )}
                </strong>
                <br />
                <small>
                  The final bill uses measured accepted weight and recorded
                  deductions. The rate above is saved with this request. The
                  time window is a preference.
                </small>
              </div>
            </>
          )}
        </Form>
      </Modal>
    );
  }
  if (modal.type === "lorry")
    return (
      <Modal title={r ? "Edit lorry" : "Add a lorry"} close={close}>
        <Form
          initial={{
            label: r?.label || "",
            vehicleNumber: r?.vehicleNumber || "",
            capacity: r ? r.capacityGrams / 1000 : "",
            areas: r?.areas.join(", ") || data.companies[0].areas.join(", "),
            driverId: r?.driverId || data.collectors[0]?.id || "",
            active: r?.active ?? true,
          }}
          onCancel={close}
          submit={r ? "Save lorry" : "Add lorry"}
          onSubmit={(v) =>
            save(
              r ? `/lorries/${r.id}` : "/lorries",
              r ? "PATCH" : "POST",
              v,
              "Lorry saved.",
            )
          }
        >
          {(bind, v, set) => (
            <>
              <Field
                label="Lorry label"
                {...bind("label")}
                required
                placeholder="Akuressa daily collection"
                maxLength={100}
              />
              <div className="form-grid">
                <Field
                  label="Vehicle number"
                  {...bind("vehicleNumber")}
                  required
                  maxLength={30}
                />
                <Field
                  label="Daily capacity (kg)"
                  {...bind("capacity")}
                  type="number"
                  required
                  min="0.001"
                  max="20000"
                  step="0.001"
                />
              </div>
              <Field
                label="Collection areas"
                {...bind("areas")}
                required
                hint="Separate areas with commas."
              />
              <Field
                label="Collector for this lorry"
                {...bind("driverId")}
                required
                options={[
                  { value: "", label: "Choose a collector" },
                  ...data.collectors.map((d) => ({
                    value: d.id,
                    label: d.name,
                  })),
                ]}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={v.active}
                  onChange={(e) => set({ ...v, active: e.target.checked })}
                />
                Accept new bookings for this lorry
              </label>
              <p className="small muted">
                Tea Sellers choose the lorry themselves. Requests go directly to its
                collector.
              </p>
            </>
          )}
        </Form>
      </Modal>
    );
  if (modal.type === "collector")
    return (
      <Modal title="Create a collector account" close={close}>
        <Form
          initial={{ name: "", email: "", phone: "", password: "" }}
          onCancel={close}
          submit="Create collector"
          onSubmit={(v) =>
            save(
              "/collectors",
              "POST",
              v,
              "Collector account created. Share the login details with your collector.",
            )
          }
        >
          {(bind) => (
            <>
              <Field
                label="Collector name"
                {...bind("name")}
                required
                maxLength={100}
              />
              <Field label="Email" {...bind("email")} type="email" required />
              <Field label="Phone" {...bind("phone")} required maxLength={30} />
              <Field
                label="Password"
                {...bind("password")}
                type="password"
                minLength={8}
                maxLength={128}
                required
                hint="At least 8 characters. Give these login details to the collector."
              />
            </>
          )}
        </Form>
      </Modal>
    );
  if (modal.type === "collect")
    return (
      <Modal title="Record collected weight" close={close}>
        <p className="muted">
          {r.ownerName} · {r.vehicleNumber} · Saved rate: {money(r.rateCents)} /
          kg
        </p>
        <Form
          initial={{
            grossWeight: "",
            rejectedWeight: "0",
            otherDeduction: "0",
            note: "",
          }}
          onCancel={close}
          submit="Save weight & generate bill"
          onSubmit={(v) =>
            save(
              `/requests/${r.id}/collect`,
              "POST",
              v,
              "Collection saved and bill generated.",
            )
          }
        >
          {(bind, v) => {
            const gross = Number(v.grossWeight || 0);
            const rejected = Number(v.rejectedWeight || 0);
            const otherDeduction = Number(v.otherDeduction || 0);
            const net = Math.max(0, gross - rejected - otherDeduction);
            const total = Math.round(net * r.rateCents);
            return (
              <>
                <div className="form-grid">
                  <Field
                    label="Gross weight (kg)"
                    {...bind("grossWeight")}
                    type="number"
                    required
                    min="0.001"
                    max="20000"
                    step="0.001"
                  />
                  <Field
                    label="Rejected weight (kg)"
                    {...bind("rejectedWeight")}
                    type="number"
                    required
                    min="0"
                    max={v.grossWeight || "20000"}
                    step="0.001"
                  />
                </div>
                <Field
                  label="Other deduction (kg)"
                  {...bind("otherDeduction")}
                  type="number"
                  required
                  min="0"
                  step="0.001"
                  max={v.grossWeight || "20000"}
                />
                <Field
                  label="Deduction / quality note"
                  {...bind("note")}
                  multiline
                  maxLength={500}
                />
                <div className="bill-preview">
                  <span>Net weight: {kg(Math.round(net * 1000))} kg</span>
                  <strong>{money(total)}</strong>
                </div>
                <p className="small muted">
                  Check the measured weight before saving. A final bill is
                  generated once and cannot be edited.
                </p>
              </>
            );
          }}
        </Form>
      </Modal>
    );
  if (modal.type === "pay")
    return (
      <Modal title="Record payment" close={close}>
        <p>
          Record payment of <strong>{money(r.bill.totalCents)}</strong> to{" "}
          {r.ownerName}.
        </p>
        <p className="small muted">
          This records a payment you already made. It does not transfer money.
        </p>
        <Form
          initial={{ reference: "" }}
          onCancel={close}
          submit="Mark as paid"
          onSubmit={(v) =>
            save(`/requests/${r.id}/pay`, "POST", v, "Payment recorded.")
          }
        >
          {(bind) => (
            <Field
              label="Bank reference / cash receipt"
              {...bind("reference")}
              required
              maxLength={100}
            />
          )}
        </Form>
      </Modal>
    );
  if (modal.type === "confirm")
    return (
      <Modal title={modal.title} close={close}>
        <p>{modal.message}</p>
        <Form
          initial={{}}
          onCancel={close}
          submit={modal.submit || "Confirm"}
          onSubmit={() =>
            save(modal.path, modal.method || "POST", {}, modal.success)
          }
        >
          {() => null}
        </Form>
      </Modal>
    );
  return null;
}
