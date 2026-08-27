export type BillingStackParamList = {
  BillingCart: undefined;
  GeneratedBill: { billId?: string } | undefined;
};

export type BillsStackParamList = {
  BillHistoryList: undefined;
  BillDetail: { billId: string };
};

export type ArticlesStackParamList = {
  HomeList: undefined;
  AddArticle: { articleId?: string } | undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  AddArticleTab: undefined;
  Billing: undefined;
  BillHistory: undefined;
  Settings: undefined;
};
