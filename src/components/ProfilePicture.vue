<template>
  <q-avatar :size="size" :color="bgColor">
    <img v-if="avatar" :src="avatar" class="avatar-img" alt="avatar" />
    <q-icon v-else name="person" color="grey-7" />
  </q-avatar>
</template>

<script setup lang="ts">
defineProps<{
  avatar?: string | undefined;
  size?: string;
  bgColor?: string;
}>();
</script>

<style scoped>
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
</style>
