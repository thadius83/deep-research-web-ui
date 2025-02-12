<script setup lang="ts">
  import { marked } from 'marked'
  import {
    writeFinalReport,
    type WriteFinalReportParams,
  } from '~/lib/deep-research'

  interface CustomReportParams extends WriteFinalReportParams {
    visitedUrls: string[]
  }

  const error = ref('')
  const loading = ref(false)
  const loadingExportPdf = ref(false)
  const reportContent = ref('')
  const reportHtml = computed(() =>
    marked(reportContent.value, { gfm: true, silent: true }),
  )
  const isExportButtonDisabled = computed(
    () => !reportContent.value || loading.value || loadingExportPdf.value,
  )

  async function generateReport(params: CustomReportParams) {
    loading.value = true
    error.value = ''
    reportContent.value = ''
    try {
      for await (const chunk of writeFinalReport(params).textStream) {
        reportContent.value += chunk
      }
      reportContent.value += `\n\n## Sources\n\n${params.visitedUrls.map((url) => `- <span class="text-sm text-gray-500 break-all">${url}</span>`).join('\n')}`
    } catch (e: any) {
      console.error(`Generate report failed`, e)
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function exportToPdf() {
    const element = document.getElementById('report-content')
    if (!element) return

    // Create a temp container
    const tempContainer = document.createElement('div')
    loadingExportPdf.value = true

    try {
      // Dinamically import html2pdf
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default

      // Copy content but not classes to avoid color format issues
      tempContainer.innerHTML = element.innerHTML

      // Use print-friendly styles with basic colors
      tempContainer.style.cssText = `
        font-family: Arial, sans-serif;
        color: #000000;
        background-color: #ffffff;
        padding: 20px;
        line-height: 1.5;
        max-width: 100%;
      `

      // Add basic styles for markdown elements
      const style = document.createElement('style')
      style.textContent = `
        * {
          box-sizing: border-box;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        h1, h2, h3, h4 { 
          color: #000000;
          margin: 1.5rem 0 1rem;
          font-weight: bold;
          page-break-after: avoid;
        }
        h1 { font-size: 2rem; }
        h2 { font-size: 1.5rem; }
        h3 { font-size: 1.25rem; }
        p { 
          margin: 0 0 1rem;
          line-height: 1.6;
        }
        ul, ol { 
          margin: 0 0 1rem;
          padding-left: 2rem;
        }
        li {
          margin-bottom: 0.5rem;
        }
        pre, code {
          background-color: #f0f0f0;
          padding: 0.5rem;
          border-radius: 4px;
          white-space: pre-wrap;
          font-family: monospace;
        }
        a {
          color: #0000ee;
          text-decoration: underline;
          word-break: break-all;
        }
        span {
          color: #666666;
          word-break: break-all;
        }
      `
      tempContainer.appendChild(style)

      document.body.appendChild(tempContainer)

      const opt = {
        margin: [10, 10],
        filename: 'research-report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
      }

      await html2pdf().set(opt).from(tempContainer).save()
    } catch (error) {
      console.error('Export to PDF failed:', error)
    } finally {
      document.body.removeChild(tempContainer)
      loadingExportPdf.value = false
    }
  }

  defineExpose({
    generateReport,
    exportToPdf,
  })
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="font-bold">4. Research Report</h2>
        <UButton
          color="info"
          variant="ghost"
          icon="i-lucide-download"
          :disabled="isExportButtonDisabled"
          :loading="loadingExportPdf"
          @click="exportToPdf"
        >
          Export PDF
        </UButton>
      </div>
    </template>

    <div
      v-if="reportContent"
      id="report-content"
      class="prose prose-lg max-w-none dark:prose-invert p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow"
      v-html="reportHtml"
    />
    <template v-else>
      <div v-if="error" class="text-red-500">{{ error }}</div>
      <div v-else class="text-sm text-gray-500">
        {{ loading ? 'Generating report...' : 'Waiting for report..' }}.
      </div>
    </template>
  </UCard>
</template>
