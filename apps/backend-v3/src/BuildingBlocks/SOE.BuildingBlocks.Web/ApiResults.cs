using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SOE.BuildingBlocks.Domain;

namespace SOE.BuildingBlocks.Web;

/// <summary>Ánh xạ Result → HTTP response chuẩn RFC 7807 (application/problem+json).</summary>
public static class ApiResults
{
    public static IResult Problem(Result result, HttpContext httpContext)
    {
        if (result.IsSuccess)
        {
            throw new InvalidOperationException("Không thể tạo ProblemDetails từ kết quả thành công.");
        }

        var error = result.Error;
        var statusCode = ToStatusCode(error.Type);

        var problem = new ProblemDetails
        {
            Type = $"https://docs.soe.local/errors/{error.Code}",
            Title = ToTitle(error.Type),
            Status = statusCode,
            Detail = error.Message,
            Instance = httpContext.Request.Path
        };

        problem.Extensions["code"] = error.Code;
        problem.Extensions["correlationId"] = httpContext.TraceIdentifier;

        if (error.FieldErrors is { Count: > 0 })
        {
            problem.Extensions["errors"] = error.FieldErrors;
        }

        return Results.Problem(problem);
    }

    private static int ToStatusCode(ErrorType type) => type switch
    {
        ErrorType.Validation => StatusCodes.Status400BadRequest,
        ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
        ErrorType.Forbidden => StatusCodes.Status403Forbidden,
        ErrorType.NotFound => StatusCodes.Status404NotFound,
        ErrorType.Conflict => StatusCodes.Status409Conflict,
        ErrorType.Locked => StatusCodes.Status423Locked,
        ErrorType.Unprocessable => StatusCodes.Status422UnprocessableEntity,
        ErrorType.Unavailable => StatusCodes.Status503ServiceUnavailable,
        _ => StatusCodes.Status500InternalServerError
    };

    private static string ToTitle(ErrorType type) => type switch
    {
        ErrorType.Validation => "Dữ liệu không hợp lệ",
        ErrorType.Unauthorized => "Chưa xác thực",
        ErrorType.Forbidden => "Không có quyền",
        ErrorType.NotFound => "Không tìm thấy",
        ErrorType.Conflict => "Xung đột dữ liệu",
        ErrorType.Locked => "Tài nguyên đang bị khóa",
        ErrorType.Unprocessable => "Không xử lý được yêu cầu",
        ErrorType.Unavailable => "Dịch vụ tạm thời không khả dụng",
        _ => "Lỗi hệ thống"
    };
}
