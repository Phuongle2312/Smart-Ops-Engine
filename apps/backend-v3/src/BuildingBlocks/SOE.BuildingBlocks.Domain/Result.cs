namespace SOE.BuildingBlocks.Domain;

/// <summary>
/// Kết quả thao tác. Quy ước: lỗi nghiệp vụ trả về Result.Failure, chỉ ném exception cho lỗi kỹ thuật.
/// </summary>
public class Result
{
    protected Result(bool isSuccess, Error error)
    {
        if (isSuccess && error != Error.None)
        {
            throw new InvalidOperationException("Kết quả thành công không được kèm lỗi.");
        }

        if (!isSuccess && error == Error.None)
        {
            throw new InvalidOperationException("Kết quả thất bại phải kèm lỗi.");
        }

        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }

    public bool IsFailure => !IsSuccess;

    public Error Error { get; }

    public static Result Success() => new(true, Error.None);

    public static Result Failure(Error error) => new(false, error);

    public static Result<TValue> Success<TValue>(TValue value) => new(value, true, Error.None);

    public static Result<TValue> Failure<TValue>(Error error) => new(default, false, error);
}

public sealed class Result<TValue> : Result
{
    private readonly TValue? _value;

    internal Result(TValue? value, bool isSuccess, Error error) : base(isSuccess, error) => _value = value;

    public TValue Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("Không thể đọc Value của kết quả thất bại.");

    public static implicit operator Result<TValue>(TValue value) => Success(value);
}
