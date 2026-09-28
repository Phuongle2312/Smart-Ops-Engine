namespace SOE.BuildingBlocks.Application.Abstractions;

/// <summary>Kết quả phân trang chuẩn cho mọi danh sách (pageSize tối đa 100 — OWASP API4).</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalItems)
{
    public const int MaxPageSize = 100;

    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalItems / (double)PageSize);

    public static PagedResult<T> Empty(int page, int pageSize) => new(Array.Empty<T>(), page, pageSize, 0);
}
