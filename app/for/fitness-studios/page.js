import VerticalLanding from "../_components/VerticalLanding";
import { verticals } from "../_data/verticals";

const v = verticals["fitness-studios"];

export const metadata = {
  title: v.metaTitle,
  description: v.metaDesc,
  openGraph: {
    title: v.metaTitle,
    description: v.metaDesc,
    images: ["/og-images/fitness-studios-og.png"], // placeholder follow-up
    url: "https://book8.io/for/fitness-studios"
  },
  alternates: {
    canonical: "https://book8.io/for/fitness-studios"
  }
};

export default function Page() {
  return <VerticalLanding verticalKey="fitness-studios" />;
}

