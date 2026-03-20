import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const transformersEntry = require.resolve('@huggingface/transformers')
const transformersWebEntry = path.join(path.dirname(transformersEntry), 'transformers.web.js')

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  env: {
    NEXT_PUBLIC_E2E_MOCK_RUNTIME: process.env.NEXT_PUBLIC_E2E_MOCK_RUNTIME || '0',
  },
  webpack: (config, { dev }) => {
    const onnxDistDir = path.dirname(require.resolve('onnxruntime-web/webgpu'))
    const onnxWebGpuEntry = path.join(
      onnxDistDir,
      dev ? 'ort.webgpu.min.js' : 'ort.webgpu.min.mjs'
    )

    config.resolve.alias = {
      ...config.resolve.alias,
      '@huggingface/transformers$': transformersWebEntry,
      'onnxruntime-web/webgpu$': onnxWebGpuEntry,
      'onnxruntime-node$': false,
      'sharp$': false,
    }

    config.module.rules.push({
      test: /onnxruntime-web[\\/]dist[\\/].*\.mjs$/,
      type: 'javascript/esm',
      resolve: {
        fullySpecified: false,
      },
    })

    return config
  },
}

export default nextConfig
