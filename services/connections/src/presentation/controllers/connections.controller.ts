import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { ConnectionsEngineService } from '../../application/services/connections-engine.service';
import { DappPlatformService } from '../../application/services/dapp-platform.service';
import { CONNECTIONS_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { successResponse } from '@auvora/nest-common';
import {
  AddWatchAddressDto,
  ApproveDappConnectionRequestDto,
  ApproveSessionDto,
  ConfirmSignDto,
  ConnectBrowserDto,
  CreateDappConnectionRequestDto,
  CreateWcSessionDto,
  PairDeviceDto,
  PrepareDappSignDto,
  PrepareSignDto,
  UpdateDappPermissionDto,
  VisitDappDto,
} from '../dto/connections.dto';

// Keep DTO value imports for ValidationPipe metadata (do not convert to `import type`).
const _connectionsDtoRuntime = {
  AddWatchAddressDto,
  ApproveDappConnectionRequestDto,
  ApproveSessionDto,
  ConfirmSignDto,
  ConnectBrowserDto,
  CreateDappConnectionRequestDto,
  CreateWcSessionDto,
  PairDeviceDto,
  PrepareDappSignDto,
  PrepareSignDto,
  UpdateDappPermissionDto,
  VisitDappDto,
};
void _connectionsDtoRuntime;

@ApiTags('connections')
@ApiBearerAuth()
@Controller('api/v1/connections')
export class ConnectionsController {
  constructor(
    @Inject(ConnectionsEngineService) private readonly engine: ConnectionsEngineService,
    @Inject(DappPlatformService) private readonly dapps: DappPlatformService,
  ) {}

  @Get('capabilities')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  capabilities() {
    return successResponse(this.engine.listCapabilities());
  }

  @Get('web3/status')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  web3Status() {
    return successResponse(this.dapps.getPlatformStatus());
  }

  @Get('devices/discover')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async discover() {
    return successResponse(await this.engine.discoverDevices());
  }

  @Get('devices')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async devices(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.engine.listDevices(user.sub));
  }

  @Post('devices/pair')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async pair(@CurrentUser() user: JwtAccessClaims, @Body() body: PairDeviceDto) {
    return successResponse(await this.engine.pairDevice(user.sub, body.deviceId));
  }

  @Post('devices/:deviceId/disconnect')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async disconnect(@CurrentUser() user: JwtAccessClaims, @Param('deviceId') deviceId: string) {
    return successResponse(await this.engine.disconnectDevice(user.sub, deviceId));
  }

  @Get('walletconnect/sessions')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async sessions(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.engine.listSessions(user.sub));
  }

  @Post('walletconnect/sessions')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async createSession(@CurrentUser() user: JwtAccessClaims, @Body() body: CreateWcSessionDto) {
    return successResponse(await this.engine.createWalletConnectSession(user.sub, body));
  }

  @Post('walletconnect/sessions/:sessionId/approve')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async approve(
    @CurrentUser() user: JwtAccessClaims,
    @Param('sessionId') sessionId: string,
    @Body() body: ApproveSessionDto,
  ) {
    return successResponse(await this.engine.approveSession(user.sub, sessionId, body.accounts));
  }

  @Post('walletconnect/sessions/:sessionId/reject')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async reject(@CurrentUser() user: JwtAccessClaims, @Param('sessionId') sessionId: string) {
    return successResponse(await this.engine.rejectSession(user.sub, sessionId));
  }

  @Post('walletconnect/sessions/:sessionId/restore')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async restore(@CurrentUser() user: JwtAccessClaims, @Param('sessionId') sessionId: string) {
    return successResponse(await this.engine.restoreSession(user.sub, sessionId));
  }

  @Post('walletconnect/sessions/:sessionId/terminate')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async terminate(@CurrentUser() user: JwtAccessClaims, @Param('sessionId') sessionId: string) {
    return successResponse(await this.engine.terminateSession(user.sub, sessionId));
  }

  @Get('browser')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async browser() {
    return successResponse(await this.engine.listBrowserWallets());
  }

  @Post('browser/connect')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async connectBrowser(@CurrentUser() user: JwtAccessClaims, @Body() body: ConnectBrowserDto) {
    return successResponse(await this.engine.connectBrowserWallet(user.sub, body.providerId));
  }

  @Get('watch')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async watch(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.engine.listWatchAddresses(user.sub));
  }

  @Post('watch')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async addWatch(@CurrentUser() user: JwtAccessClaims, @Body() body: AddWatchAddressDto) {
    return successResponse(await this.engine.addWatchAddress(user.sub, body));
  }

  @Delete('watch/:watchId')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async removeWatch(@CurrentUser() user: JwtAccessClaims, @Param('watchId') watchId: string) {
    return successResponse(await this.engine.removeWatchAddress(user.sub, watchId));
  }

  @Get('dapps/requests')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async listDappRequests(@CurrentUser() user: JwtAccessClaims, @Query('status') status?: string) {
    return successResponse(await this.dapps.listConnectionRequests(user.sub, status));
  }

  @Post('dapps/requests')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async createDappRequest(
    @CurrentUser() user: JwtAccessClaims,
    @Body() body: CreateDappConnectionRequestDto,
  ) {
    return successResponse(await this.dapps.createConnectionRequest(user.sub, body));
  }

  @Post('dapps/requests/:requestId/approve')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async approveDappRequest(
    @CurrentUser() user: JwtAccessClaims,
    @Param('requestId') requestId: string,
    @Body() body: ApproveDappConnectionRequestDto,
  ) {
    return successResponse(await this.dapps.approveConnectionRequest(user.sub, requestId, body));
  }

  @Post('dapps/requests/:requestId/reject')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async rejectDappRequest(
    @CurrentUser() user: JwtAccessClaims,
    @Param('requestId') requestId: string,
  ) {
    return successResponse(await this.dapps.rejectConnectionRequest(user.sub, requestId));
  }

  @Get('dapps/trusted')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async trustedDapps(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.dapps.listTrustedDapps(user.sub));
  }

  @Post('dapps/trusted/:trustedDappId/revoke')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async revokeTrusted(
    @CurrentUser() user: JwtAccessClaims,
    @Param('trustedDappId') trustedDappId: string,
  ) {
    return successResponse(await this.dapps.revokeTrustedDapp(user.sub, trustedDappId));
  }

  @Get('dapps/permissions')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async permissions(@CurrentUser() user: JwtAccessClaims, @Query('origin') origin?: string) {
    return successResponse(await this.dapps.listPermissions(user.sub, origin));
  }

  @Post('dapps/permissions')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async updatePermission(
    @CurrentUser() user: JwtAccessClaims,
    @Body() body: UpdateDappPermissionDto,
  ) {
    return successResponse(await this.dapps.updatePermission(user.sub, body));
  }

  @Get('dapps/browser/bookmarks')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async bookmarks(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.dapps.listBookmarks(user.sub));
  }

  @Post('dapps/browser/visit')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async visit(@CurrentUser() user: JwtAccessClaims, @Body() body: VisitDappDto) {
    return successResponse(await this.dapps.visitDapp(user.sub, body));
  }

  @Delete('dapps/browser/bookmarks/:bookmarkId')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async removeBookmark(
    @CurrentUser() user: JwtAccessClaims,
    @Param('bookmarkId') bookmarkId: string,
  ) {
    return successResponse(await this.dapps.removeBookmark(user.sub, bookmarkId));
  }

  @Get('dapps/activity')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async activity(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.dapps.listActivity(user.sub));
  }

  @Get('dapps/sessions/summary')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async sessionSummary(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.dapps.sessionSummary(user.sub));
  }

  @Post('dapps/sign/prepare')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async prepareDappSign(@CurrentUser() user: JwtAccessClaims, @Body() body: PrepareDappSignDto) {
    return successResponse(await this.dapps.prepareDappSign(user.sub, body));
  }

  @Post('sign/prepare')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async prepareSign(@CurrentUser() user: JwtAccessClaims, @Body() body: PrepareSignDto) {
    return successResponse(await this.engine.prepareSign(user.sub, body));
  }

  @Post('sign/confirm')
  @Permissions(CONNECTIONS_PERMISSIONS.WRITE)
  async confirmSign(@CurrentUser() user: JwtAccessClaims, @Body() body: ConfirmSignDto) {
    return successResponse(await this.engine.confirmSign(user.sub, body.requestId, body.confirmed));
  }

  @Get('sign/requests')
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async signRequests(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.engine.listSigningRequests(user.sub));
  }

  @Get()
  @Permissions(CONNECTIONS_PERMISSIONS.READ)
  async list(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.engine.listConnections(user.sub));
  }
}
