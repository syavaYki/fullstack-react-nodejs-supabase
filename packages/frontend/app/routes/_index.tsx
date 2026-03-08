import type { Route } from './+types/_index';
import HeroSection from '~/components/landing/HeroSection';
import PainPointSection from '~/components/landing/PainPointSection';
import FeaturesShowcase from '~/components/landing/FeaturesShowcase';
import SocialProofSection from '~/components/landing/SocialProofSection';
import PricingSection from '~/components/landing/PricingSection';
import NewsletterSection from '~/components/landing/NewsletterSection';
import CTASection from '~/components/landing/CTASection';
import { branding } from '@config/branding';

export function meta({}: Route.MetaArgs) {
  return [
    {
      title: `${branding.projectDisplayName} - ${branding.heroHeadline} ${branding.heroHeadlineAccent}`,
    },
    {
      name: 'description',
      content: branding.metaDescription,
    },
  ];
}

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <PainPointSection />
      <FeaturesShowcase />
      <SocialProofSection />
      <PricingSection />
      <NewsletterSection />
      <CTASection />
    </>
  );
}
