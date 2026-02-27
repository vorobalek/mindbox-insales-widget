import type { MindboxInSalesWidgetState, MindboxWidgetConfig } from './contracts';
import { createIds } from './config';
import type { SendOperation } from './operationSender';

export interface PageViewSenderDeps {
  stateRef: MindboxInSalesWidgetState;
  config: MindboxWidgetConfig;
  sendOperation: SendOperation;
}

export const sendInitialPageViews = (deps: PageViewSenderDeps): void => {
  const page = deps.config.page;
  const operations = deps.config.operations;
  const idKey = deps.config.idKey || 'website';

  if (page && page.template === 'collection' && page.collectionId && !deps.stateRef.collectionViewSent) {
    deps.sendOperation(operations && operations.viewCategory, {
      viewProductCategory: {
        productCategory: {
          ids: createIds(idKey, page.collectionId)
        }
      }
    });
    deps.stateRef.collectionViewSent = true;
  }

  if (page && page.template === 'product' && page.productId && !deps.stateRef.productViewSent) {
    deps.sendOperation(operations && operations.viewProduct, {
      viewProduct: {
        price: String(page.productPrice),
        productGroup: {
          ids: createIds(idKey, page.productId)
        }
      }
    });
    deps.stateRef.productViewSent = true;
  }
};
