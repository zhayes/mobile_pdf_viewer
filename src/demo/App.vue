<script setup lang="ts">
import { shallowRef } from "vue";
import MobilePDFViewer from '../index';

const pdf_ref = shallowRef<typeof MobilePDFViewer>();

const inputFile = async(e:any) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0] as File;

  const buffer = await file.arrayBuffer();

  pdf_ref.value!.loadPDF(buffer);

}
</script>
<template>
<div>
    <input type="file" @change="inputFile" />
    <div style="height: 100vh;">
        <MobilePDFViewer ref="pdf_ref"/>
    </div>
</div>
</template>
<style>
*{
    margin: 0px;
    padding: 0px;
}
</style>
