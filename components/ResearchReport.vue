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
      reportContent.value += `\n\n## Sources\n\n${params.visitedUrls
        .map(
          (url) =>
            `- <a href="${url}" style="color:blue; text-decoration:underline;">${url}</a>`
        )
        .join('\n')}`
    } catch (e: any) {
      console.error(`Generate report failed`, e)
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // Helper function that recursively removes any inline styles that include "oklch"
  function removeUnsupportedStyles(element: HTMLElement) {
    if (element.hasAttribute('style')) {
      const styleValue = element.getAttribute('style')
      if (styleValue && styleValue.includes('oklch')) {
        element.removeAttribute('style')
      }
    }
    Array.from(element.children).forEach((child) => {
      removeUnsupportedStyles(child as HTMLElement)
    })
  }

  async function exportToPdf() {
    const element = document.getElementById('report-content')
    if (!element) return

    // Create a temporary container for export
    const tempContainer = document.createElement('div')
    loadingExportPdf.value = true

    try {
      // Dynamically import html2pdf
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default

      // Create a wrapper container with header and footer.
      const exportWrapper = document.createElement('div')
      exportWrapper.style.padding = '20px'
      exportWrapper.style.backgroundColor = '#ffffff'
      exportWrapper.style.fontFamily = 'Arial, sans-serif'
      exportWrapper.style.color = '#000000'
      exportWrapper.style.lineHeight = '1.8'
      exportWrapper.style.maxWidth = '800px'
      exportWrapper.style.margin = '0 auto'

      // Create header element.
      const headerEl = document.createElement('div')
      headerEl.style.textAlign = 'center'
      headerEl.style.marginBottom = '20px'
      headerEl.innerHTML = `
        <h1 style="margin: 0; font-size: 28px;">Research Report</h1>
        <p style="margin: 0; font-size: 14px;">Generated on ${new Date().toLocaleDateString()}</p>
      `
      exportWrapper.appendChild(headerEl)

      // Clone the element to export and remove external classes/styles.
      const clone = element.cloneNode(true) as HTMLElement
      clone.removeAttribute('class')
      clone.querySelectorAll('*').forEach((el) => {
        el.removeAttribute('class')
      })
      // Remove any inline style containing "oklch"
      removeUnsupportedStyles(clone)
      // Append the clean clone to the wrapper.
      exportWrapper.appendChild(clone)

      // Create footer element.
      const footerEl = document.createElement('div')
      footerEl.style.textAlign = 'center'
      footerEl.style.fontSize = '10px'
      footerEl.style.marginTop = '20px'
      footerEl.innerHTML = `<p>Deep Research Assistant - Confidential</p>`
      exportWrapper.appendChild(footerEl)

      // Insert custom CSS to force safe colors and improve layout.
      const style = document.createElement('style')
      style.textContent = `
        * {
          color: #000 !important;
          background-color: #fff !important;
          box-sizing: border-box;
          word-wrap: break-word;
          word-break: break-all;
        }
        h1, h2, h3, h4 {
          margin: 0 0 10px !important;
          page-break-after: avoid;
        }
        p {
          margin: 0 0 10px !important;
        }
        a {
          color: blue !important;
          text-decoration: underline !important;
        }
        ul {
          padding-left: 20px !important;
        }
      `
      exportWrapper.appendChild(style)

      // Append the exportWrapper to the temp container and attach to the body.
      tempContainer.appendChild(exportWrapper)
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
