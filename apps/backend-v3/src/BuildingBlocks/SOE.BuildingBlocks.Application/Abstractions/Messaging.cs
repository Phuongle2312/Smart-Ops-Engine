using MediatR;
using SOE.BuildingBlocks.Domain;

namespace SOE.BuildingBlocks.Application.Abstractions;

/// <summary>Command: thao tác ghi, luôn trả về Result (không ném exception cho lỗi nghiệp vụ).</summary>
public interface ICommand : IRequest<Result>;

public interface ICommand<TResponse> : IRequest<Result<TResponse>>;

public interface ICommandHandler<TCommand> : IRequestHandler<TCommand, Result>
    where TCommand : ICommand;

public interface ICommandHandler<TCommand, TResponse> : IRequestHandler<TCommand, Result<TResponse>>
    where TCommand : ICommand<TResponse>;

/// <summary>Query: thao tác đọc, không thay đổi trạng thái.</summary>
public interface IQuery<TResponse> : IRequest<Result<TResponse>>;

public interface IQueryHandler<TQuery, TResponse> : IRequestHandler<TQuery, Result<TResponse>>
    where TQuery : IQuery<TResponse>;
