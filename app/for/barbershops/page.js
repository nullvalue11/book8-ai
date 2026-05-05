import VerticalLanding from "../_components/VerticalLanding";
import { verticals } from "../_data/verticals";

const v = verticals.barbershops;

export const metadata = {
  title: v.metaTitle,
  description: v.metaDesc,
  openGraph: {
    title: v.metaTitle,
    description: v.metaDesc,
    images: ["/og-images/barbershops-og.png"], // placeholder follow-up
    url: "https://book8.io/for/barbershops"
  },
  alternates: {
    canonical: "https://book8.io/for/barbershops"
  }
};

export default function Page() {
  return <VerticalLanding verticalKey="barbershops" />;
}

