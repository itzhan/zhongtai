export interface Product {
  id: number;
  name: string;
  status: string | null;
  capacity: string | null;
  projectId: number | null;
  notes: string;
  sortOrder: number;
  project: { id: number; code: string; name: string } | null;
}

/// 各表单的项目下拉框共用 —— /api/projects 返回的字段是它的超集。
export interface ProjectOption {
  id: number;
  code: string;
  name: string;
}
