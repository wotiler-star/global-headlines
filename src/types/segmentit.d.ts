// segmentit 为纯 JS 词典分词库，无自带类型声明，这里给出最小声明。
declare module "segmentit" {
  const Segment: any;
  export function useDefault(seg: any): any;
  export default Segment;
}
