# argv.pl <pid>: 그 프로세스의 실행 인자를 커널에서 원래 배열 그대로 읽어, 인자마다 16진수 한 줄로 낸다.
# ps는 인자를 공백으로 이어 붙여 경계를 잃는다. 읽을 수 없거나 개수가 맞지 않으면 아무것도 내지 않고 1로 끝낸다.
use strict;
my $pid = shift;
$pid =~ /^\d+$/ or exit 1;
my @args;
if ($^O eq 'darwin') {
  my $mib = pack('i3', 1, 49, $pid);   # CTL_KERN, KERN_PROCARGS2
  my $len = 1 << 20;
  my $buf = "\0" x $len;
  my $size = pack('Q', $len);
  syscall(202, $mib, 3, $buf, $size, 0, 0) == 0 or exit 1;   # SYS___sysctl
  my $raw = substr($buf, 0, unpack('Q', $size));
  my $argc = unpack('i', $raw);
  my $rest = substr($raw, 4);
  $rest =~ s/^[^\0]*\0+//;   # 실행 파일 경로와 뒤 패딩을 건너뛴다
  my @all = split /\0/, $rest, -1;
  @all >= $argc or exit 1;
  @args = @all[0 .. $argc - 1];
} elsif ($^O eq 'linux') {
  open(my $fh, '<', "/proc/$pid/cmdline") or exit 1;
  local $/;
  my $raw = <$fh>;
  $raw =~ /\0\z/ or exit 1;
  @args = split /\0/, $raw, -1;
  pop @args;
} else {
  exit 1;
}
@args > 0 or exit 1;
print unpack('H*', $_), "\n" for @args;
