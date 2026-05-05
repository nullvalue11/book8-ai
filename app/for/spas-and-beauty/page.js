import VerticalLanding from "../_components/VerticalLanding";
import { verticals } from "../_data/verticals";

const v = verticals["spas-and-beauty"];

export const metadata = {
  title: v.metaTitle,
  description: v.metaDesc,
  openGraph: {
    title: v.metaTitle,
    description: v.metaDesc,
    images: ["/og-images/spas-and-beauty-og.png"], // placeholder follow-up
    url: "https://book8.io/for/spas-and-beauty"
  },
  alternates: {
    canonical: "https://book8.io/for/spas-and-beauty"
  }
};

export default function Page() {
  return <VerticalLanding verticalKey="spas-and-beauty" />;
}

