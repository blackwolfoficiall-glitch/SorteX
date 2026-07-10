import Header from "../components/Header";
import HeroBanner from "../components/home/HeroBanner";
import Categories from "../components/home/Categories";
import FeaturedCampaigns from "../components/home/FeaturedCampaigns";
import PromotionBanner from "../components/home/PromotionBanner";
import BottomNavigation from "../components/home/BottomNavigation";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <>
      <Header />

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">

        <HeroBanner />

        <Categories />

        <PromotionBanner />

        <FeaturedCampaigns />

      </main>

      <BottomNavigation />

      <Footer />
    </>
  );
}