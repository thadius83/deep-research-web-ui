<script setup lang="ts">
  const show = ref(false)
  const password = defineModel<string>()
</script>

<template>
  <form @submit.prevent class="w-full">
    <UInput
      v-model="password"
      :type="show ? 'text' : 'password'"
      :ui="{ trailing: 'pe-1' }"
      autocomplete="off"
    >
      <template #trailing>
        <UButton
          type="button"
          color="neutral"
          variant="link"
          size="sm"
          :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :aria-label="show ? 'Hide' : 'Show'"
          :aria-pressed="show"
          aria-controls="password"
          @click="show = !show"
        />
      </template>
    </UInput>
  </form>
</template>
