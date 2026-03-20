import Script from 'next/script'
import type { Metadata } from 'next'

import ShowcasePageClient from '@/components/showcase-page-client'

const title = 'LLM Showcase — Local-First WebGPU Chat'
const description =
  'A browser-local Qwen showcase with WebGPU inference, persistent chat history, adjustable generation controls, and a polished editorial interface.'

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'LLM Showcase',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web Browser',
  description,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Browser-local WebGPU inference',
    'Persistent local chat history',
    'Adjustable generation settings',
    'Model switching between Qwen variants',
    'No server-side inference calls',
  ],
}

export const metadata: Metadata = {
  title,
  description,
  applicationName: 'LLM Showcase',
  keywords: [
    'LLM',
    'WebGPU',
    'browser inference',
    'Qwen',
    'Transformers.js',
    'local AI',
    'chat showcase',
  ],
  openGraph: {
    title,
    description,
    type: 'website',
    siteName: 'LLM Showcase',
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
}

export default function HomePage() {
  return (
    <>
      <Script
        id="llm-showcase-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd),
        }}
      />
      <ShowcasePageClient />
    </>
  )
}
