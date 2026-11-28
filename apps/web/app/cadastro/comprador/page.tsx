import RegistrationForm from "@/components/auth/RegistrationForm";
import RegistrationAccessScope from "../RegistrationAccessScope";

export default function CadastroComprador() {
  return (
    <RegistrationAccessScope>
      <RegistrationForm role="BUYER" />
    </RegistrationAccessScope>
  );
}
