import VerticalLanding from "../_components/VerticalLanding";
import { verticals } from "../_data/verticals";

const v = verticals.dental;

export const metadata = {
  title: v.metaTitle,
  description: v.metaDesc,
  openGraph: {
    title: v.metaTitle,
    description: v.metaDesc,
    images: ["/og-images/dental-og.png"], // placeholder follow-up
    url: "https://book8.io/for/dental"
  },
  alternates: {
    canonical: "https://book8.io/for/dental"
  }
};

export default function Page() {
  return <VerticalLanding verticalKey="dental" />;
}

