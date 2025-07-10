<script setup lang="ts">
import { shallowRef } from "vue";
import MobilePDFViewer from '../index';

const pdf_ref = shallowRef<InstanceType<typeof MobilePDFViewer>>();

const inputFile = async(e:any) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0] as File;

  const buffer = await file.arrayBuffer();
  pdf_ref.value!.resetPosition();
  pdf_ref.value!.loadPDF(buffer);

}

const onLoadComplete = (pageCount: number) => {
  console.log(`PDF 加载完成，共 ${pageCount} 页`);
};

const onScaleChange = (scale: number) => {
  console.log(`当前缩放比例: ${scale}`);
};
</script>
<template>
<div>
    <input type="file" @change="inputFile" />
    <div style="height: 100vh;">
        <MobilePDFViewer
            ref="pdf_ref"
          @load-complete="onLoadComplete"
          @scale-change="onScaleChange"
        />
    </div>
</div>
</template>
<style>
*{
    margin: 0px;
    padding: 0px;
}
</style>
