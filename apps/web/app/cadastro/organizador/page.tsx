import RegistrationForm from "@/components/auth/RegistrationForm";
import RegistrationAccessScope from "../RegistrationAccessScope";

export default function CadastroOrganizador() {
  return (
    <RegistrationAccessScope>
      <RegistrationForm role="ORGANIZER" />
    </RegistrationAccessScope>
  );
}
