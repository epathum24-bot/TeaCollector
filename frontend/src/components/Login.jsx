import { useState } from "react";
import { api, session } from "../api/client.js";
import { Brand, Field, Form, Icon } from "./ui.jsx";
export default function Login({ onLogin }) {
  const [register, setRegister] = useState(false);
  async function submit(values) {
    const result = await api(
      `/auth/${register ? "register" : "login"}`,
      "POST",
      values,
    );
    session.set(result.token);
    await onLogin();
  }
  return (
    <main className="auth-layout">
      <section className="auth-photo">
        <Brand />
        <div className="auth-story">
          <span className="eyebrow">GROWN WITH CARE. COLLECTED WITH EASE.</span>
          <h1>
            A better day
            <br />
            for your tea.
          </h1>
          <p>
            Choose your lorry. Arrange your pickup.
            <br />
            Keep every collection and bill in one place.
          </p>
          <div className="story-line">
            <Icon name="leaf" /> Rooted in Sri Lanka
          </div>
        </div>
        <span className="photo-credit">Tea estates &middot; Sri Lanka</span>
      </section>
      <section className="auth-form">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-inner">
          <span className="eyebrow green">YOUR TEA COLLECTION WORKSPACE</span>
          <h2>{register ? "Let's get you started." : "Welcome back."}</h2>
          <p className="muted">
            {register
              ? "Create a Tea Seller or collection company account."
              : "Log in to manage your next collection."}
          </p>
          <Form
            key={String(register)}
            initial={{
              email: "",
              password: "",
              role: "owner",
              name: "",
              phone: "",
              address: "",
              companyName: "",
              areas: "",
              rate: "",
            }}
            onSubmit={submit}
            submit={register ? "Create account" : "Log in"}
          >
            {(bind, values) => (
              <>
                {register && (
                  <>
                    <Field
                      label="Account type"
                      {...bind("role")}
                      options={[
                        { value: "owner", label: "Tea Seller" },
                        { value: "company", label: "Tea collection company" },
                      ]}
                    />
                    <div className="form-grid">
                      <Field
                        label="Your name"
                        {...bind("name")}
                        required
                        maxLength={100}
                        autoComplete="name"
                      />
                      <Field
                        label="Phone number"
                        {...bind("phone")}
                        required
                        maxLength={30}
                        autoComplete="tel"
                      />
                    </div>
                  </>
                )}
                <Field
                  label="Email address"
                  {...bind("email")}
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
                <Field
                  label="Password"
                  {...bind("password")}
                  type="password"
                  required
                  minLength={register ? 8 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  hint={register ? "Use at least 8 characters." : undefined}
                />
                {register && (
                  <>
                    <Field
                      label="Address"
                      {...bind("address")}
                      placeholder="Estate or company address"
                      maxLength={300}
                    />
                    {values.role === "company" && (
                      <>
                        <Field
                          label="Company name"
                          {...bind("companyName")}
                          required
                          maxLength={100}
                        />
                        <Field
                          label="Collection areas"
                          {...bind("areas")}
                          required
                          hint="Separate areas with commas."
                        />
                        <Field
                          label="Current buying price (LKR / kg)"
                          {...bind("rate")}
                          type="number"
                          min="0"
                          max="100000"
                          step="0.01"
                          required
                        />
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </Form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to TeaCollector?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
              }}
              className="link"
            >
              {register ? "Log in" : "Create an account"}
            </button>
          </p>
        </div>
        <div className="auth-meta">
          <p>Secure tea collection management</p>
          <small>&copy; 2026 TeaCollector &middot; Privacy &middot; Help</small>
        </div>
      </section>
    </main>
  );
}
