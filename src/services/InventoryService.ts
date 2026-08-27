import { ArticleRepository } from '@/repositories/ArticleRepository';
import { validateCartQuantityAgainstStock } from '@/utils/validation';
import { ValidationResult } from '@/types';

export const InventoryService = {
  /**
   * Validates a requested quantity for an article against LIVE stock,
   * re-reading the database rather than trusting a value the UI cached
   * earlier. Also accounts for quantity of the SAME article already
   * sitting elsewhere in the current cart (so adding two lines of the same
   * article can't jointly exceed stock even though each line individually
   * looks fine).
   */
  async validateQuantity(
    articleId: string,
    requestedQty: number,
    alreadyInCartForThisArticle: number
  ): Promise<ValidationResult> {
    const article = await ArticleRepository.getById(articleId);
    if (!article) {
      return { valid: false, message: 'Article no longer exists.' };
    }
    const totalRequested = requestedQty + alreadyInCartForThisArticle;
    return validateCartQuantityAgainstStock(totalRequested, article.quantity);
  },
};
