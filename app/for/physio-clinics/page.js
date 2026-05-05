import VerticalLanding from "../_components/VerticalLanding";
import { verticals } from "../_data/verticals";

const v = verticals["physio-clinics"];

export const metadata = {
  title: v.metaTitle,
  description: v.metaDesc,
  openGraph: {
    title: v.metaTitle,
    description: v.metaDesc,
    images: ["/og-images/physio-clinics-og.png"], // placeholder follow-up
    url: "https://book8.io/for/physio-clinics"
  },
  alternates: {
    canonical: "https://book8.io/for/physio-clinics"
  }
};

export default function Page() {
  return <VerticalLanding verticalKey="physio-clinics" />;
}

