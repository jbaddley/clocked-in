import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";

/** Name, email, username, and temporary password for a new account. Pair with readPersonIdentity. */
export function PersonIdentityFields({ idPrefix }: { idPrefix: string }) {
  return (
    <>
      <Field label="First name" htmlFor={`${idPrefix}-firstName`}>
        <Input id={`${idPrefix}-firstName`} name="firstName" required maxLength={100} className="h-9" />
      </Field>
      <Field label="Last name" htmlFor={`${idPrefix}-lastName`}>
        <Input id={`${idPrefix}-lastName`} name="lastName" required maxLength={100} className="h-9" />
      </Field>
      <Field label="Email" htmlFor={`${idPrefix}-email`}>
        <Input id={`${idPrefix}-email`} name="email" type="email" required className="h-9" />
      </Field>
      <Field label="Username" htmlFor={`${idPrefix}-username`}>
        <Input id={`${idPrefix}-username`} name="username" required minLength={3} maxLength={50} className="h-9" />
      </Field>
      <Field
        label="Temporary password"
        htmlFor={`${idPrefix}-password`}
        className="sm:col-span-2"
        hint="They will choose a new password the first time they sign in."
      >
        <Input id={`${idPrefix}-password`} name="password" type="password" required minLength={8} className="h-9" />
      </Field>
    </>
  );
}

export function readPersonIdentity(data: FormData) {
  const text = (key: string) => String(data.get(key) ?? "");
  return {
    email: text("email"),
    username: text("username"),
    password: text("password"),
    firstName: text("firstName"),
    lastName: text("lastName"),
  };
}
