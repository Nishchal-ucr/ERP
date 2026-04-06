import { BadRequestException } from '@nestjs/common';
import { DailyReportService } from './daily-report.service';
import { SubmitDailyReportDto } from './dto/submit-daily-report.dto';

describe('DailyReportService', () => {
  let service: DailyReportService;
  let mockRepository: any;
  const mockSaleService = {
    createMultipleSalesWithItems: jest.fn(),
    deleteByDailyReport: jest.fn(),
  };
  const mockFeedReceiptService = {
    createMultipleFeedReceipts: jest.fn(),
    deleteByDailyReport: jest.fn(),
  };
  const mockShedDailyReportService = {
    createMultipleShedDailyReports: jest.fn(),
    deleteByDailyReport: jest.fn(),
  };

  beforeEach(() => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };

    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    service = new DailyReportService(
      mockRepository,
      mockSaleService as any,
      mockFeedReceiptService as any,
      mockShedDailyReportService as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw when max reportDate is greater than DTO reportDate', async () => {
    mockRepository
      .createQueryBuilder()
      .getRawOne.mockResolvedValue({ max: 20240103 });

    const dto: SubmitDailyReportDto = {
      reportDate: '2024-01-02',
      submitterId: 1,
    };

    await expect(service.updateDailyReport(dto)).rejects.toThrow(
      new BadRequestException(
        'Cannot submit: A report for this date has already been submitted and locked.',
      ),
    );
  });

  it('should create a new record when no existing report and max is not greater', async () => {
    mockRepository
      .createQueryBuilder()
      .getRawOne.mockResolvedValue({ max: 20240102 });
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockReturnValue({
      reportDate: 20240102,
      createdByUserId: 1,
      status: 'SUBMITTED',
    });
    mockRepository.save.mockResolvedValue({
      id: 1,
      reportDate: 20240102,
      createdByUserId: 1,
      status: 'SUBMITTED',
    });

    const dto: SubmitDailyReportDto = {
      reportDate: '2024-01-02',
      submitterId: 1,
    };

    const result = await service.updateDailyReport(dto);

    expect(result).toEqual({
      id: 1,
      reportDate: 20240102,
      createdByUserId: 1,
      status: 'SUBMITTED',
    });
    expect(mockRepository.create).toHaveBeenCalled();
    expect(mockRepository.save).toHaveBeenCalled();
    expect(mockSaleService.deleteByDailyReport).toHaveBeenCalledWith(1);
    expect(mockFeedReceiptService.deleteByDailyReport).toHaveBeenCalledWith(1);
    expect(mockShedDailyReportService.deleteByDailyReport).toHaveBeenCalledWith(
      1,
    );
    expect(mockSaleService.createMultipleSalesWithItems).not.toHaveBeenCalled();
    expect(
      mockFeedReceiptService.createMultipleFeedReceipts,
    ).not.toHaveBeenCalled();
    expect(
      mockShedDailyReportService.createMultipleShedDailyReports,
    ).not.toHaveBeenCalled();
  });

  it('should update an existing record when reportDate exists and max is not greater', async () => {
    const existingReport = {
      id: 3,
      reportDate: 20240103,
      status: 'DRAFT',
      createdByUserId: 2,
    };

    mockRepository
      .createQueryBuilder()
      .getRawOne.mockResolvedValue({ max: 20240103 });
    mockRepository.findOne.mockResolvedValue(existingReport);
    mockRepository.save.mockImplementation((report) => Promise.resolve(report));

    const dto: SubmitDailyReportDto = {
      reportDate: '2024-01-03',
      submitterId: 5,
    };

    const result = await service.updateDailyReport(dto);

    expect(result).toMatchObject({
      id: 3,
      reportDate: 20240103,
      status: 'SUBMITTED',
      createdByUserId: 5,
    });
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUBMITTED', createdByUserId: 5 }),
    );
    expect(mockSaleService.deleteByDailyReport).toHaveBeenCalledWith(3);
    expect(mockFeedReceiptService.deleteByDailyReport).toHaveBeenCalledWith(3);
    expect(mockShedDailyReportService.deleteByDailyReport).toHaveBeenCalledWith(
      3,
    );
  });
});
